# backend/app/api/v1/endpoints/auth.py
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user, get_current_token
from app.core.config import settings
from app.core.security import create_access_token, revoke_token
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, MessageResponse
from app.services.auth_service import authenticate_user

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest):
    token_resp, error = authenticate_user(login_data.username, login_data.password)
    if error:
        raise error
    return token_resp

@router.post("/refresh", response_model=TokenResponse)
def refresh_session(current_user: UserResponse = Depends(get_current_user)):
    """
    Cơ chế tự động làm mới phiên (Silent Refresh / Sliding Expiration).
    Gia hạn thêm thời gian hiệu lực cho người dùng khi còn hoạt động hoặc thao tác.
    """
    new_access_token = create_access_token(subject=current_user.username, role=current_user.role)
    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=current_user
    )

@router.post("/logout", response_model=MessageResponse)
def logout(
    token: str = Depends(get_current_token),
    _: UserResponse = Depends(get_current_user)
):
    """
    Hủy / thu hồi hiệu lực của token hiện tại ngay lập tức phía server (Blacklist).
    Token này sẽ không thể sử dụng để gọi bất kỳ API nào khác nữa.
    """
    revoke_token(token)
    return MessageResponse(
        message="Đăng xuất thành công. Phiên làm việc đã bị thu hồi ngay lập tức trên máy chủ."
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user
