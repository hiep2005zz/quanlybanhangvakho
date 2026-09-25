# backend/app/api/v1/endpoints/users.py
import re
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user, require_permission
from app.core.rbac import Role, Permission, ROLE_DETAILS
from app.core.security import get_password_hash
from app.models.user import USERS_DB, UserInDB, get_next_user_id, persist_user, delete_persisted_user
from app.schemas.auth import UserResponse
from app.schemas.user import CustomerCreate, CustomerCreateResponse, UserCreate, UserUpdate, UserItemResponse, UserListResponse
from app.services.customer_account import generate_temporary_password, send_customer_credentials

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

    display_branch = getattr(u, "branch", None) or ("Chưa phân công" if u.role == Role.CUSTOMER.value else "Kho Tổng Hà Nội")
    return UserItemResponse(
        id=u.id,
        username=u.username,
        full_name=u.full_name,
        email=u.email,
        phone=getattr(u, "phone", None),
        role=u.role,
        role_title=role_info.get("title", u.role),
        branch=display_branch,
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
    Láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng trong há»‡ thá»‘ng (Chá»‰ dÃ nh cho Quáº£n trá»‹ viÃªn - Zero-Trust).
    """
    users = [_build_user_item(u) for u in sorted(USERS_DB.values(), key=lambda x: x.id)]
    return UserListResponse(users=users, total=len(users))

@router.post("", response_model=UserItemResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    current_user: UserResponse = Depends(require_permission(Permission.USER_MANAGE.value))
):
    """
    Táº¡o ngÆ°á»i dÃ¹ng má»›i trong há»‡ thá»‘ng:
    - Admin cÃ³ quyá»n táº¡o thÃªm tÃ i khoáº£n Admin khÃ¡c hoáº·c báº¥t ká»³ vai trÃ² nÃ o trong 7 vai trÃ².
    - LÆ°u vÃ o cÆ¡ sá»Ÿ dá»¯ liá»‡u USERS_DB vÃ  cÃ³ thá»ƒ Ä‘Äƒng nháº­p Ä‘Æ°á»£c ngay.
    """
    valid_roles = [r.value for r in Role]
    if data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vai trÃ² '{data.role}' khÃ´ng há»£p lá»‡. Vui lÃ²ng chá»n 1 trong 7 vai trÃ² há»‡ thá»‘ng."
        )

    # Chuáº©n hÃ³a username
    raw_username = (data.username or data.email.split("@")[0]).strip().lower()
    clean_username = re.sub(r'[^a-zA-Z0-9_\-\.]', '', raw_username)
    if not clean_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TÃªn Ä‘Äƒng nháº­p khÃ´ng há»£p lá»‡."
        )

    if clean_username in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"TÃªn Ä‘Äƒng nháº­p '{clean_username}' Ä‘Ã£ tá»“n táº¡i trong há»‡ thá»‘ng."
        )

    clean_email = data.email.strip().lower()
    for existing in USERS_DB.values():
        if existing.email and existing.email.strip().lower() == clean_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{clean_email}' Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng bá»Ÿi ngÆ°á»i dÃ¹ng khÃ¡c."
            )

    new_user = UserInDB(
        id=get_next_user_id(),
        username=clean_username,
        full_name=data.full_name.strip(),
        email=clean_email,
        role=data.role,
        hashed_password=get_password_hash(data.password),
        branch=data.branch.strip() if data.branch else "Kho Tá»•ng HÃ  Ná»™i",
        is_active=True,
    )
    persist_user(new_user)
    USERS_DB[clean_username] = new_user
    return _build_user_item(new_user)

@router.post("/customers", response_model=CustomerCreateResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    data: CustomerCreate,
    current_user: UserResponse = Depends(require_permission(Permission.USER_MANAGE.value))
):
    """Táº¡o tÃ i khoáº£n khÃ¡ch hÃ ng khÃ´ng cÃ³ role nghiá»‡p vá»¥ hoáº·c Ä‘á»‹a bÃ n kho."""
    clean_email = data.email.strip().lower()
    for existing in USERS_DB.values():
        if existing.email and existing.email.strip().lower() == clean_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{clean_email}' Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng bá»Ÿi ngÆ°á»i dÃ¹ng khÃ¡c."
            )

    raw_username = re.sub(r'[^a-zA-Z0-9_.-]', '', (data.username or clean_email.split("@", 1)[0]).strip().lower()) or "customer"
    username = raw_username
    suffix = 2
    while username in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"TÃªn Ä‘Äƒng nháº­p '{raw_username}' Ä‘Ã£ tá»“n táº¡i trong há»‡ thá»‘ng."
        )

    clean_phone = data.phone.strip()
    for existing in USERS_DB.values():
        if getattr(existing, "phone", None) == clean_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sá»‘ Ä‘iá»‡n thoáº¡i '{clean_phone}' Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng bá»Ÿi ngÆ°á»i dÃ¹ng khÃ¡c."
            )

    temporary_password = generate_temporary_password()
    new_user = UserInDB(
        id=get_next_user_id(),
        username=username,
        full_name=data.full_name.strip(),
        email=clean_email,
        phone=clean_phone,
        role=Role.CUSTOMER.value,
        hashed_password=get_password_hash(temporary_password),
        branch=None,
        is_active=True,
    )
    email_sent = send_customer_credentials(clean_email, new_user.full_name, username, temporary_password, clean_phone)
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không gửi được email mật khẩu. Tài khoản chưa được tạo; vui lòng thử lại sau.",
        )

    persist_user(new_user)
    USERS_DB[username] = new_user
    return CustomerCreateResponse(
        user=_build_user_item(new_user),
        email_sent=email_sent,
        message="Đã tạo tài khoản và gửi mật khẩu về email nhân viên kinh doanh.",
    )

@router.put("/{username}", response_model=UserItemResponse)
def update_user(
    username: str,
    data: UserUpdate,
    current_user: UserResponse = Depends(require_permission(Permission.USER_MANAGE.value))
):
    """
    Cáº­p nháº­t thÃ´ng tin ngÆ°á»i dÃ¹ng:
    - Báº¢O Vá»† ADMIN: KhÃ´ng Ä‘Æ°á»£c tá»± háº¡ quyá»n Admin cá»§a chÃ­nh mÃ¬nh.
    - Báº¢O Vá»† ADMIN: KhÃ´ng Ä‘Æ°á»£c tá»± khÃ³a tÃ i khoáº£n Admin cá»§a chÃ­nh mÃ¬nh.
    """
    target_username = username.strip().lower()
    user = USERS_DB.get(target_username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng '{username}'."
        )

    is_self = (current_user.username.strip().lower() == target_username)

    # Kiá»ƒm tra rÃ ng buá»™c khÃ´ng Ä‘Æ°á»£c tá»± háº¡ quyá»n Admin
    if is_self and data.role is not None and data.role != Role.SYSTEM_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="KhÃ´ng Ä‘Æ°á»£c tá»± háº¡ quyá»n Admin cá»§a chÃ­nh mÃ¬nh."
        )

    # Kiá»ƒm tra rÃ ng buá»™c khÃ´ng Ä‘Æ°á»£c tá»± khÃ³a tÃ i khoáº£n cá»§a chÃ­nh mÃ¬nh
    wants_to_lock = (data.is_active is False) or (data.status == "LOCKED")
    if is_self and wants_to_lock:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="KhÃ´ng Ä‘Æ°á»£c tá»± khÃ³a tÃ i khoáº£n Admin cá»§a chÃ­nh mÃ¬nh."
        )

    # AC 2: Báº¯t buá»™c ghi lÃ½ do khi khÃ³a tÃ i khoáº£n
    if wants_to_lock:
        reason = (data.lock_reason or "").strip()
        if not reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Báº¯t buá»™c pháº£i nháº­p lÃ½ do khi khÃ³a tÃ i khoáº£n (VÃ­ dá»¥: Nghá»‰ viá»‡c, chuyá»ƒn cÃ´ng tÃ¡c...)."
            )
        user.is_active = False
        user.status = "LOCKED"
        user.lock_reason = reason
        user.locked_at = datetime.now(timezone.utc)
        # AC 1: Tá»± Ä‘á»™ng tÄƒng token_version Ä‘á»ƒ thu há»“i ngay láº­p tá»©c má»i phiÃªn Ä‘ang má»Ÿ
        user.token_version = getattr(user, "token_version", 1) + 1
    elif data.is_active is True or data.status == "ACTIVE":
        # Má»Ÿ khÃ³a tÃ i khoáº£n
        user.is_active = True
        user.status = "ACTIVE"
        user.lock_reason = None
        user.locked_at = None

    if data.role is not None:
        valid_roles = [r.value for r in Role]
        if data.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vai trÃ² '{data.role}' khÃ´ng há»£p lá»‡."
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
                    detail=f"Email '{clean_email}' Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng bá»Ÿi ngÆ°á»i dÃ¹ng khÃ¡c."
                )
        user.email = clean_email

    if data.phone is not None and data.phone.strip():
        clean_phone = data.phone.strip()
        for uname, existing in USERS_DB.items():
            if uname != target_username and getattr(existing, "phone", None) == clean_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Sá»‘ Ä‘iá»‡n thoáº¡i '{clean_phone}' Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng bá»Ÿi ngÆ°á»i dÃ¹ng khÃ¡c."
                )
        user.phone = clean_phone

    if data.branch is not None:
        user.branch = data.branch.strip()

    if data.password is not None and len(data.password.strip()) >= 3:
        user.hashed_password = get_password_hash(data.password.strip())
        user.token_version = getattr(user, "token_version", 1) + 1

    persist_user(user)
    return _build_user_item(user)

@router.delete("/{username}")
def delete_user(
    username: str,
    current_user: UserResponse = Depends(require_permission(Permission.USER_MANAGE.value))
):
    """
    XÃ³a tÃ i khoáº£n ngÆ°á»i dÃ¹ng:
    - Báº¢O Vá»† ADMIN: Tuyá»‡t Ä‘á»‘i khÃ´ng Ä‘Æ°á»£c tá»± xÃ³a tÃ i khoáº£n Admin cá»§a chÃ­nh mÃ¬nh!
    """
    target_username = username.strip().lower()
    if target_username not in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng '{username}'."
        )

    # Báº¢O Vá»† ADMIN: Cháº·n tá»± xÃ³a chÃ­nh mÃ¬nh
    if current_user.username.strip().lower() == target_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="KhÃ´ng Ä‘Æ°á»£c tá»± xÃ³a tÃ i khoáº£n Admin cá»§a chÃ­nh mÃ¬nh."
        )

    del USERS_DB[target_username]
    delete_persisted_user(target_username)
    return {
        "status": "success",
        "message": f"ÄÃ£ xÃ³a thÃ nh cÃ´ng ngÆ°á»i dÃ¹ng '{target_username}' khá»i há»‡ thá»‘ng."
    }

@router.get("/{username}/dealers")
def get_user_dealers(
    username: str,
    current_user: UserResponse = Depends(require_permission(Permission.USER_MANAGE.value))
):
    """
    Láº¥y danh sÃ¡ch cÃ¡c Ä‘áº¡i lÃ½ do nhÃ¢n viÃªn nÃ y phá»¥ trÃ¡ch Ä‘á»ƒ kiá»ƒm tra hoáº·c bÃ n giao.
    """
    target_username = username.strip().lower()
    user = USERS_DB.get(target_username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng '{username}'."
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
    BÃ n giao toÃ n bá»™ Ä‘áº¡i lÃ½ cá»§a nhÃ¢n viÃªn bá»‹ khÃ³a sang cho nhÃ¢n viÃªn má»›i.
    """
    target_username = username.strip().lower()
    old_user = USERS_DB.get(target_username)
    if not old_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"KhÃ´ng tÃ¬m tháº¥y nhÃ¢n viÃªn nguá»“n '{username}'."
        )

    new_uname = data.new_sale_username.strip().lower()
    new_user = USERS_DB.get(new_uname)
    if not new_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"KhÃ´ng tÃ¬m tháº¥y nhÃ¢n viÃªn má»›i '{data.new_sale_username}'."
        )

    if not new_user.is_active or getattr(new_user, "status", "ACTIVE") == "LOCKED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"NhÃ¢n viÃªn má»›i '{new_user.full_name}' cÅ©ng Ä‘ang bá»‹ khÃ³a tÃ i khoáº£n! Vui lÃ²ng chá»n nhÃ¢n viÃªn Ä‘ang hoáº¡t Ä‘á»™ng."
        )

    # Chuyá»ƒn toÃ n bá»™ Ä‘áº¡i lÃ½ sang nhÃ¢n viÃªn má»›i
    transferred_count = 0
    for d in DEALERS_DB.values():
        if d.assigned_sale_id == old_user.id:
            d.assigned_sale_id = new_user.id
            transferred_count += 1

    return {
        "status": "success",
        "message": f"ÄÃ£ bÃ n giao thÃ nh cÃ´ng {transferred_count} Ä‘áº¡i lÃ½ tá»« '{old_user.full_name}' sang '{new_user.full_name}'.",
        "transferred_count": transferred_count,
        "new_assigned_sale_id": new_user.id,
        "new_assigned_sale_name": new_user.full_name
    }




