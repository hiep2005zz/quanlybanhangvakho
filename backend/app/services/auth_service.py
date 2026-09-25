# backend/app/services/auth_service.py
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.security import verify_password, create_access_token
from app.models.user import USERS_DB, UserInDB
from app.schemas.auth import TokenResponse, UserResponse

# Global track for failed attempts by username (even if user doesn't exist in DB, to prevent enumeration)
FAILED_ATTEMPTS: dict[str, dict] = {}

def get_current_utc() -> datetime:
    return datetime.now(timezone.utc)

def authenticate_user(username: str, password: str) -> Tuple[Optional[TokenResponse], Optional[HTTPException]]:
    uname = username.strip().lower()
    now = get_current_utc()

    # Track attempts state
    attempt_record = FAILED_ATTEMPTS.get(uname, {"count": 0, "locked_until": None})

    # 1. Check if currently locked out
    if attempt_record["locked_until"] and attempt_record["locked_until"] > now:
        remaining_seconds = int((attempt_record["locked_until"] - now).total_seconds())
        remaining_minutes = max(1, (remaining_seconds + 59) // 60)
        return None, HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": f"Tài khoản đã bị tạm khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau {remaining_minutes} phút.",
                "lock_remaining_seconds": remaining_seconds
            }
        )

    # 2. Check user in database by username or email
    user: Optional[UserInDB] = USERS_DB.get(uname)
    if not user:
        for u in USERS_DB.values():
            if u.email and u.email.strip().lower() == uname:
                user = u
                break

    # AC 1 & AC 2: Nếu tài khoản bị Quản trị viên khóa -> Trả về 403 Forbidden với lý do khóa
    if user and (getattr(user, "status", "ACTIVE") == "LOCKED" or not user.is_active):
        reason = getattr(user, "lock_reason", None) or "Tài khoản bị tạm khóa bởi Quản trị viên."
        return None, HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tài khoản đã bị khóa. Lý do: {reason}"
        )

    # Verify password if user exists
    is_valid = False
    if user and user.is_active:
        is_valid = verify_password(password, user.hashed_password)

    if not is_valid:
        # Increment failed attempts
        attempt_record["count"] += 1
        current_count = attempt_record["count"]

        if current_count >= settings.MAX_FAILED_ATTEMPTS:
            # Lock for 15 minutes
            attempt_record["locked_until"] = now + timedelta(minutes=settings.LOCKOUT_MINUTES)
            attempt_record["count"] = 0  # reset count for next cycle
            FAILED_ATTEMPTS[uname] = attempt_record
            remaining_seconds = settings.LOCKOUT_MINUTES * 60
            return None, HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": "Tài khoản đã bị tạm khóa 15 phút do nhập sai 5 lần liên tiếp.",
                    "lock_remaining_seconds": remaining_seconds
                }
            )
        else:
            FAILED_ATTEMPTS[uname] = attempt_record
            remaining_tries = settings.MAX_FAILED_ATTEMPTS - current_count
            return None, HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "message": "Tên đăng nhập hoặc mật khẩu không chính xác.",
                    "remaining_attempts": remaining_tries
                }
            )

    # 3. Successful login -> reset failed attempts
    FAILED_ATTEMPTS[uname] = {"count": 0, "locked_until": None}

    access_token = create_access_token(
        subject=user.username,
        role=user.role,
        token_version=getattr(user, "token_version", 1)
    )
    from app.core.rbac import get_role_permissions, ROLE_DETAILS
    role_info = ROLE_DETAILS.get(user.role, {})
    token_resp = TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse(
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            permissions=get_role_permissions(user.role),
            role_title=role_info.get("title", user.role),
            branch=getattr(user, "branch", "Kho Tổng Hà Nội"),
            can_view_cost=role_info.get("can_view_cost", False),
            can_write_inventory=role_info.get("can_write_inventory", False),
        )
    )
    return token_resp, None
