# backend/app/models/user.py - Seed Database Fresh v2
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.core.security import get_password_hash

class UserInDB(BaseModel):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    role: str  # 'admin', 'sales', 'warehouse'
    hashed_password: str
    is_active: bool = True
    failed_attempts: int = 0
    locked_until: Optional[datetime] = None
    token_version: int = 1

# Initial database seed (passwords are '123' hashed with bcrypt)
USERS_DB: dict[str, UserInDB] = {
    "admin": UserInDB(
        id=1,
        username="admin",
        full_name="Nguyễn Quản Trị",
        email="daongochiep645@gmail.com",
        role="admin",
        hashed_password=get_password_hash("123"),
    ),
    "sales": UserInDB(
        id=2,
        username="sales",
        full_name="Trần Bán Hàng",
        email="daongochiep645@gmail.com",
        role="sales",
        hashed_password=get_password_hash("123"),
    ),
    "kho": UserInDB(
        id=3,
        username="kho",
        full_name="Lê Thủ Kho",
        email="kho@congty.vn",
        role="warehouse",
        hashed_password=get_password_hash("123"),
    ),
}
