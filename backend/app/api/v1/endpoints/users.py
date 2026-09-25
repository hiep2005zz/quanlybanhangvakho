# backend/app/api/v1/endpoints/users.py
import re
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user, require_permission
from app.core.rbac import Role, Permission, ROLE_DETAILS
from app.core.security import get_password_hash
from app.models.user import USERS_DB, UserInDB, get_next_user_id
from app.schemas.auth import UserResponse
from app.schemas.user import UserCreate, UserUpdate, UserItemResponse, UserListResponse

router = APIRouter()

from datetime import datetime, timezone
from app.models.dealer import count_dealers_by_sale_id, get_dealers_by_sale_id, DEALERS_DB

def _build_user_item(u: UserInDB) -> UserItemResponse:
    role_info = ROLE_DETAILS.get(u.role, {})
    handover_count = count_dealers_by_sale_id(u.id) if (not u.is_active or getattr(u, "status", "ACTIVE") == "LOCKED") else 0
    locked_at_str = u.locked_at.isoformat() if getattr(u, "locked_at", None) else None
    user_status = getattr(u, "status", "ACTIVE")
    if not u.is_active:
        user_status = "LOCKED"

    return UserItemResponse(
        id=u.id,
        username=u.username,
        full_name=u.full_name,
        email=u.email,
        role=u.role,
        role_title=role_info.get("title", u.role),
        branch=getattr(u, "branch", "Kho Tổng Hà Nội") or "Kho Tổng Hà Nội",
        is_active=u.is_active and user_status == "ACTIVE",
        status=user_status,
        lock_reason=getattr(u, "lock_reason", None),
        locked_at=locked_at_str,
        dealers_needing_handover=handover_count,
        can_view_cost=role_info.get("can_view_cost", False),
        can_write_inventory=role_info.get("can_write_inventory", False),
        badge_color=role_info.get("badge_color", "#64748b"),
    )

@router.get("", response_model=UserListResponse)
def list_users(
    current_user: UserResponse = Depends(require_permission(Permission.USER_MANAGE.value))
):
    """
    Lấy danh sách người dùng trong hệ thống (Chỉ dành cho Quản trị viên - Zero-Trust).
    """
    users = [_build_user_item(u) for u in sorted(USERS_DB.values(), key=lambda x: x.id)]
    return UserListResponse(users=users, total=len(users))

@router.post("", response_model=UserItemResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    current_user: UserResponse = Depends(require_permission(Permission.USER_MANAGE.value))
):
    """
    Tạo người dùng mới trong hệ thống:
    - Admin có quyền tạo thêm tài khoản Admin khác hoặc bất kỳ vai trò nào trong 7 vai trò.
    - Lưu vào cơ sở dữ liệu USERS_DB và có thể đăng nhập được ngay.
    """
    valid_roles = [r.value for r in Role]
    if data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vai trò '{data.role}' không hợp lệ. Vui lòng chọn 1 trong 7 vai trò hệ thống."
        )

    # Chuẩn hóa username
    raw_username = (data.username or data.email.split("@")[0]).strip().lower()
    clean_username = re.sub(r'[^a-zA-Z0-9_\-\.]', '', raw_username)
    if not clean_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập không hợp lệ."
        )

    if clean_username in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên đăng nhập '{clean_username}' đã tồn tại trong hệ thống."
        )

    clean_email = data.email.strip().lower()
    for existing in USERS_DB.values():
        if existing.email and existing.email.strip().lower() == clean_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{clean_email}' đã được sử dụng bởi người dùng khác."
            )

    new_user = UserInDB(
        id=get_next_user_id(),
        username=clean_username,
        full_name=data.full_name.strip(),
        email=clean_email,
        role=data.role,
        hashed_password=get_password_hash(data.password),
        branch=data.branch.strip() if data.branch else "Kho Tổng Hà Nội",
        is_active=True,
    )
    USERS_DB[clean_username] = new_user
    return _build_user_item(new_user)

@router.put("/{username}", response_model=UserItemResponse)
def update_user(
    username: str,
    data: UserUpdate,
    current_user: UserResponse = Depends(require_permission(Permission.USER_MANAGE.value))
):
    """
    Cập nhật thông tin người dùng:
    - BẢO VỆ ADMIN: Không được tự hạ quyền Admin của chính mình.
    - BẢO VỆ ADMIN: Không được tự khóa tài khoản Admin của chính mình.
    """
    target_username = username.strip().lower()
    user = USERS_DB.get(target_username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy người dùng '{username}'."
        )

    is_self = (current_user.username.strip().lower() == target_username)

    # Kiểm tra ràng buộc không được tự hạ quyền Admin
    if is_self and data.role is not None and data.role != Role.SYSTEM_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không được tự hạ quyền Admin của chính mình."
        )

    # Kiểm tra ràng buộc không được tự khóa tài khoản của chính mình
    wants_to_lock = (data.is_active is False) or (data.status == "LOCKED")
    if is_self and wants_to_lock:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không được tự khóa tài khoản Admin của chính mình."
        )

    # AC 2: Bắt buộc ghi lý do khi khóa tài khoản
    if wants_to_lock:
        reason = (data.lock_reason or "").strip()
        if not reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bắt buộc phải nhập lý do khi khóa tài khoản (Ví dụ: Nghỉ việc, chuyển công tác...)."
            )
        user.is_active = False
        user.status = "LOCKED"
        user.lock_reason = reason
        user.locked_at = datetime.now(timezone.utc)
        # AC 1: Tự động tăng token_version để thu hồi ngay lập tức mọi phiên đang mở
        user.token_version = getattr(user, "token_version", 1) + 1
    elif data.is_active is True or data.status == "ACTIVE":
        # Mở khóa tài khoản
        user.is_active = True
        user.status = "ACTIVE"
        user.lock_reason = None
        user.locked_at = None

    if data.role is not None:
        valid_roles = [r.value for r in Role]
        if data.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vai trò '{data.role}' không hợp lệ."
            )
        user.role = data.role

    if data.full_name is not None and data.full_name.strip():
        user.full_name = data.full_name.strip()

    if data.email is not None and data.email.strip():
        clean_email = data.email.strip().lower()
        for uname, existing in USERS_DB.items():
            if uname != target_username and existing.email and existing.email.strip().lower() == clean_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{clean_email}' đã được sử dụng bởi người dùng khác."
                )
        user.email = clean_email

    if data.branch is not None:
        user.branch = data.branch.strip()

    if data.password is not None and len(data.password.strip()) >= 3:
        user.hashed_password = get_password_hash(data.password.strip())
        user.token_version = getattr(user, "token_version", 1) + 1

    return _build_user_item(user)

@router.delete("/{username}")
def delete_user(
    username: str,
    current_user: UserResponse = Depends(require_permission(Permission.USER_MANAGE.value))
):
    """
    Xóa tài khoản người dùng:
    - BẢO VỆ ADMIN: Tuyệt đối không được tự xóa tài khoản Admin của chính mình!
    """
    target_username = username.strip().lower()
    if target_username not in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy người dùng '{username}'."
        )

    # BẢO VỆ ADMIN: Chặn tự xóa chính mình
    if current_user.username.strip().lower() == target_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không được tự xóa tài khoản Admin của chính mình."
        )

    del USERS_DB[target_username]
    return {
        "status": "success",
        "message": f"Đã xóa thành công người dùng '{target_username}' khỏi hệ thống."
    }

@router.get("/{username}/dealers")
def get_user_dealers(
    username: str,
    current_user: UserResponse = Depends(require_permission(Permission.USER_MANAGE.value))
):
    """
    Lấy danh sách các đại lý do nhân viên này phụ trách để kiểm tra hoặc bàn giao.
    """
    target_username = username.strip().lower()
    user = USERS_DB.get(target_username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy người dùng '{username}'."
        )

    dealers = get_dealers_by_sale_id(user.id)
    is_locked = (not user.is_active) or (getattr(user, "status", "ACTIVE") == "LOCKED")
    return {
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "is_locked": is_locked,
        "lock_reason": getattr(user, "lock_reason", None),
        "total_dealers": len(dealers),
        "dealers": [
            {
                "id": d.id,
                "code": d.code,
                "name": d.name,
                "phone": d.phone,
                "email": d.email,
                "address": d.address,
                "assigned_sale_id": d.assigned_sale_id,
                "needs_handover": is_locked
            }
            for d in dealers
        ]
    }

class HandoverRequest(BaseModel):
    new_sale_username: str

@router.post("/{username}/handover")
def handover_dealers(
    username: str,
    data: HandoverRequest,
    current_user: UserResponse = Depends(require_permission(Permission.USER_MANAGE.value))
):
    """
    Bàn giao toàn bộ đại lý của nhân viên bị khóa sang cho nhân viên mới.
    """
    target_username = username.strip().lower()
    old_user = USERS_DB.get(target_username)
    if not old_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy nhân viên nguồn '{username}'."
        )

    new_uname = data.new_sale_username.strip().lower()
    new_user = USERS_DB.get(new_uname)
    if not new_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy nhân viên mới '{data.new_sale_username}'."
        )

    if not new_user.is_active or getattr(new_user, "status", "ACTIVE") == "LOCKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Nhân viên mới '{new_user.full_name}' cũng đang bị khóa tài khoản! Vui lòng chọn nhân viên đang hoạt động."
        )

    # Chuyển toàn bộ đại lý sang nhân viên mới
    transferred_count = 0
    for d in DEALERS_DB.values():
        if d.assigned_sale_id == old_user.id:
            d.assigned_sale_id = new_user.id
            transferred_count += 1

    return {
        "status": "success",
        "message": f"Đã bàn giao thành công {transferred_count} đại lý từ '{old_user.full_name}' sang '{new_user.full_name}'.",
        "transferred_count": transferred_count,
        "new_assigned_sale_id": new_user.id,
        "new_assigned_sale_name": new_user.full_name
    }

