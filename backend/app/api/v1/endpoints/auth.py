from fastapi import APIRouter

from app.schemas.auth import ForgotPasswordRequest, MessageResponse, ResetPasswordRequest
from app.services.password_reset import password_reset_service

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/forgot-password', response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest) -> MessageResponse:
    return MessageResponse(message=password_reset_service.request_reset(str(payload.email)))


@router.post('/reset-password', response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest) -> MessageResponse:
    return MessageResponse(
        message=password_reset_service.reset_password(payload.token, payload.new_password),
    )
