# backend/app/api/v1/endpoints/profile.py
"""
User Story SCRUM-27 (S2-02): Xem và cập nhật hồ sơ cá nhân.
- GET /api/v1/me (hoặc /api/v1/profile): Xem thông tin hồ sơ của tài khoản đang đăng nhập.
- PUT /api/v1/me (hoặc PATCH /api/v1/profile): Cập nhật họ tên và số điện thoại Việt Nam.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.rbac import ROLE_DETAILS
from app.models.entities import UserEntity
from app.models.user import USERS_DB, save_users_db
from app.schemas.auth import UserResponse
from app.schemas.profile import UserProfileResponse, UpdateProfileRequest
from app.services.audit_service import log_audit_event

router = APIRouter()


def _build_profile_response(username: str, db: Optional[Session] = None) -> UserProfileResponse:
    """Helper xây dựng đối tượng UserProfileResponse từ USERS_DB hoặc SQL Server DB."""
    user_in_mem = USERS_DB.get(username.lower())
    
    # Ưu tiên lấy thông tin mới nhất từ SQL Database nếu có
    db_user: Optional[UserEntity] = None
    if db is not None:
        try:
            db_user = db.query(UserEntity).filter(UserEntity.username == username).first()
        except Exception:
            db_user = None

    user_id = (user_in_mem.id if user_in_mem else None) or (db_user.id if db_user else 0)
    full_name = (user_in_mem.full_name if user_in_mem and user_in_mem.full_name else None) or (db_user.full_name if db_user else username)
    email = (user_in_mem.email if user_in_mem and user_in_mem.email else None) or (db_user.email if db_user else None)
    phone = (getattr(user_in_mem, "phone", None) if user_in_mem and getattr(user_in_mem, "phone", None) else None) or (db_user.phone if db_user else None)
    role = (user_in_mem.role if user_in_mem and user_in_mem.role else None) or (db_user.role if db_user else "sales")
    roles = (user_in_mem.get_roles() if user_in_mem else None) or (db_user.get_roles() if db_user else [role])
    branch = getattr(user_in_mem, "branch", None) or (db_user.branch if db_user else None) or "Kho Tổng Hà Nội"

    role_info = ROLE_DETAILS.get(role, {})
    role_title = role_info.get("title", role)

    # Phân loại kho / địa bàn
    warehouse_name = branch if ("kho" in branch.lower() or "toàn quốc" in branch.lower()) else branch
    territory_name = branch if ("khu vực" in branch.lower() or "toàn quốc" in branch.lower() or "miền" in branch.lower()) else branch

    return UserProfileResponse(
        id=user_id,
        username=username,
        email=email,
        full_name=full_name,
        phone_number=phone,
        phone=phone,
        role=role,
        roles=roles,
        role_title=role_title,
        warehouse_name=warehouse_name,
        territory_name=territory_name,
        branch=branch,
    )


@router.get("", response_model=UserProfileResponse)
def get_my_profile(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Xem thông tin hồ sơ cá nhân của tài khoản đang đăng nhập:
    - Trả về: id, username, email, full_name, phone_number, role, warehouse_name, territory_name.
    - Cho phép cả 7 vai trò truy cập (chỉ cần đăng nhập hợp lệ).
    """
    return _build_profile_response(current_user.username, db=db)


@router.put("", response_model=UserProfileResponse)
@router.patch("", response_model=UserProfileResponse)
def update_my_profile(
    data: UpdateProfileRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cập nhật thông tin hồ sơ cá nhân:
    - CHỈ cho phép cập nhật: full_name và phone_number.
    - Bắt buộc kiểm tra định dạng số điện thoại Việt Nam (10 chữ số, đúng đầu số).
    - RÀNG BUỘC BẢO MẬT: Tuyệt đối không thay đổi username, email, role, warehouse, territory.
    """
    username = current_user.username.lower()
    user_in_mem = USERS_DB.get(username)
    if not user_in_mem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài khoản người dùng."
        )

    old_full_name = user_in_mem.full_name
    old_phone = getattr(user_in_mem, "phone", None)

    # 1. Cập nhật trong bộ nhớ USERS_DB
    user_in_mem.full_name = data.full_name
    user_in_mem.phone = data.phone_number

    # 2. Cập nhật trong cơ sở dữ liệu SQL Server (nếu kết nối được)
    if db is not None:
        try:
            db_user = db.query(UserEntity).filter(UserEntity.username == current_user.username).first()
            if db_user:
                db_user.full_name = data.full_name
                db_user.phone = data.phone_number
                db.commit()
                db.refresh(db_user)
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            print(f"Warning: Failed to update UserEntity directly in DB: {e}")

    # 3. Đồng bộ lại toàn bộ dữ liệu người dùng
    save_users_db()

    # 4. Ghi vết nhật ký thao tác (Audit Log)
    try:
        log_audit_event(
            db=db,
            user=current_user,
            action_type="USER_UPDATE",
            entity_type="User",
            entity_id=current_user.username,
            old_val={"full_name": old_full_name, "phone": old_phone},
            new_val={"full_name": data.full_name, "phone": data.phone_number},
            reason="Cập nhật hồ sơ cá nhân",
            request=request,
        )
    except Exception as e:
        print(f"Audit log error: {e}")

    return _build_profile_response(current_user.username, db=db)
