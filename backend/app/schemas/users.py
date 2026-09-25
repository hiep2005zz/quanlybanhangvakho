from datetime import datetime
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Role = Literal["admin", "sales", "warehouse"]


def validate_phone(value: str) -> str:
    phone = value.strip()
    if not re.fullmatch(r"(?:0|\+84)(?:3|5|7|8|9)\d{8}", phone):
        raise ValueError("Số điện thoại phải đúng định dạng Việt Nam, ví dụ 0901234567.")
    return phone


def validate_gmail(value: EmailStr) -> EmailStr:
    email = str(value).lower()
    if not email.endswith("@gmail.com"):
        raise ValueError("Email phải có định dạng @gmail.com.")
    return value


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=12)
    role: Literal["sales", "warehouse"]
    territory: str = Field(min_length=1, max_length=120)

    _validate_phone = field_validator("phone")(validate_phone)
    _validate_gmail = field_validator("email")(validate_gmail)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=10, max_length=12)
    role: Role | None = None
    territory: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool | None = None

    _validate_phone = field_validator("phone")(validate_phone)
    _validate_gmail = field_validator("email")(validate_gmail)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    email: EmailStr
    phone: str
    role: Role
    territory: str
    is_active: bool
    created_at: datetime


class UserCreateResponse(BaseModel):
    user: UserResponse
    temporary_password: str
    activation_link: str


class UserListResponse(BaseModel):
    items: list[UserResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
