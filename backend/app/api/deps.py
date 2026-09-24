# backend/app/api/deps.py
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_access_token, is_token_revoked
from app.models.user import USERS_DB, UserInDB
from app.schemas.auth import UserResponse

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_token(token: Optional[str] = Depends(oauth2_scheme)) -> str:
    """Lấy token xác thực thô từ header Bearer."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu xác thực. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token

def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> UserResponse:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu xác thực. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Kiểm tra xem token đã bị hủy (đăng xuất) hay chưa
    if is_token_revoked(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên làm việc đã bị thu hồi hoặc đã đăng xuất. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    username: str = payload.get("sub", "")
    user: Optional[UserInDB] = USERS_DB.get(username)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại hoặc đã bị khóa.",
        )

    # Kiểm tra token_version: Nếu mật khẩu đã đổi, token_version trong DB sẽ tăng lên,
    # các phiên cũ có token_version nhỏ hơn sẽ bị thu hồi ngay lập tức
    token_version = payload.get("token_version", 1)
    user_token_version = getattr(user, "token_version", 1)
    if token_version != user_token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên làm việc đã bị thu hồi do đổi mật khẩu. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return UserResponse(
        username=user.username,
        full_name=user.full_name,
        role=user.role
    )
