# backend/app/schemas/auth.py
from typing import Optional
from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    username: str
    full_name: str
    role: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 900 # Thời hạn hiệu lực tính theo giây (15 phút)
    user: UserResponse
    remaining_attempts: Optional[int] = None

class MessageResponse(BaseModel):
    message: str
    status: str = "success"
