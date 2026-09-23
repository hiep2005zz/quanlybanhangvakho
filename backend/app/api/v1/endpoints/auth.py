# backend/app/api/v1/endpoints/auth.py
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.auth_service import authenticate_user

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest):
    token_resp, error = authenticate_user(login_data.username, login_data.password)
    if error:
        raise error
    return token_resp

@router.get("/me", response_model=UserResponse)
def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user
