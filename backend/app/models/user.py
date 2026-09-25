# backend/app/models/user.py - Seed Database Fresh v3 with 7 Roles
import os
import json
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.core.security import get_password_hash
from app.core.rbac import Role

DB_FILE_PATH = os.path.join(os.path.dirname(__file__), "users_data.json")

class UserInDB(BaseModel):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str  # Vai trò chính (backward compatibility)
    roles: List[str] = Field(default_factory=list)  # Danh sách nhiều vai trò cùng lúc
    hashed_password: str
    branch: Optional[str] = "Kho Tổng Hà Nội"
    is_active: bool = True
    status: str = "ACTIVE"  # ACTIVE | LOCKED
    lock_reason: Optional[str] = None
    locked_at: Optional[datetime] = None
    failed_attempts: int = 0
    locked_until: Optional[datetime] = None
    token_version: int = 1

    def get_roles(self) -> List[str]:
        """Lấy danh sách các vai trò chuẩn hóa."""
        if self.roles and len(self.roles) > 0:
            return list(self.roles)
        if self.role:
            return [self.role]
        return [Role.SALES.value]

# Password mặc định cho tất cả tài khoản mẫu là '123'
DEFAULT_HASH = get_password_hash("123")

# Initial database seed for all 7 business roles
USERS_DB: dict[str, UserInDB] = {
    # 1. Quản trị hệ thống (System Admin)
    "admin": UserInDB(
        id=1,
        username="admin",
        full_name="Nguyễn Quản Trị",
        email="admin@congty.vn",
        role=Role.SYSTEM_ADMIN.value,
        roles=[Role.SYSTEM_ADMIN.value],
        hashed_password=DEFAULT_HASH,
        branch="Toàn quốc",
    ),
    # 2. Quản lý kinh doanh (Sales Manager)
    "sales_manager": UserInDB(
        id=2,
        username="sales_manager",
        full_name="Phạm Trưởng Phòng Sales",
        email="sales.manager@congty.vn",
        role=Role.SALES_MANAGER.value,
        roles=[Role.SALES_MANAGER.value],
        hashed_password=DEFAULT_HASH,
        branch="Toàn quốc",
    ),
    # 3. Nhân viên kinh doanh (Sales Staff)
    "sales": UserInDB(
        id=3,
        username="sales",
        full_name="Trần Bán Hàng",
        email="sales@congty.vn",
        role=Role.SALES.value,
        roles=[Role.SALES.value],
        hashed_password=DEFAULT_HASH,
        branch="Khu vực Miền Bắc",
    ),
    # 4. Thủ kho (Warehouse Staff)
    "kho": UserInDB(
        id=4,
        username="kho",
        full_name="Lê Thủ Kho",
        email="kho@congty.vn",
        role=Role.WAREHOUSE_STAFF.value,
        roles=[Role.WAREHOUSE_STAFF.value],
        hashed_password=DEFAULT_HASH,
        branch="Kho Tổng Hà Nội",
    ),
    # 5. Quản lý kho (Warehouse Manager)
    "warehouse_mgr": UserInDB(
        id=5,
        username="warehouse_mgr",
        full_name="Hoàng Quản Lý Kho",
        email="warehouse.manager@congty.vn",
        role=Role.WAREHOUSE_MANAGER.value,
        roles=[Role.WAREHOUSE_MANAGER.value],
        hashed_password=DEFAULT_HASH,
        branch="Kho Tổng Hà Nội",
    ),
    # 6. Kế toán (Accountant)
    "ketoan": UserInDB(
        id=6,
        username="ketoan",
        full_name="Đặng Kế Toán",
        email="ketoan@congty.vn",
        role=Role.ACCOUNTANT.value,
        roles=[Role.ACCOUNTANT.value],
        hashed_password=DEFAULT_HASH,
        branch="Trụ sở chính",
    ),
    # 7. Nhân viên mua hàng (Purchasing Staff)
    "muahang": UserInDB(
        id=7,
        username="muahang",
        full_name="Vũ Mua Hàng",
        email="muahang@congty.vn",
        role=Role.PURCHASING_STAFF.value,
        roles=[Role.PURCHASING_STAFF.value],
        hashed_password=DEFAULT_HASH,
        branch="Trụ sở chính",
    ),
}

def save_users_db():
    """Lưu USERS_DB ra file JSON để duy trì dữ liệu khi server reload."""
    try:
        data = {k: v.model_dump(mode="json") for k, v in USERS_DB.items()}
        with open(DB_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving users db: {e}")

def load_users_db():
    """Nạp USERS_DB từ file JSON nếu có."""
    if os.path.exists(DB_FILE_PATH):
        try:
            with open(DB_FILE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                for k, v in data.items():
                    USERS_DB[k] = UserInDB(**v)
        except Exception as e:
            print(f"Error loading users db: {e}")

def get_next_user_id() -> int:
    """Tự động sinh ID tăng dần cho user mới."""
    if not USERS_DB:
        return 1
    return max(u.id for u in USERS_DB.values()) + 1

# Tự động nạp dữ liệu đã lưu khi khởi động
load_users_db()

