# backend/app/schemas/user.py
from typing import Optional, List
from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    username: Optional[str] = None
    password: str = Field(..., min_length=3, max_length=128)
    role: str
    branch: Optional[str] = "Kho Tổng Hà Nội"

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    branch: Optional[str] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None  # ACTIVE | LOCKED
    lock_reason: Optional[str] = None

class UserItemResponse(BaseModel):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    role: str
    role_title: str
    branch: str
    is_active: bool
    status: str = "ACTIVE"
    lock_reason: Optional[str] = None
    locked_at: Optional[str] = None
    dealers_needing_handover: int = 0
    can_view_cost: bool = False
    can_write_inventory: bool = False
    badge_color: str = "#64748b"

class UserListResponse(BaseModel):
    users: List[UserItemResponse]
    total: int
