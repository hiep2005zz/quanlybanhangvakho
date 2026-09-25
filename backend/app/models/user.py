# backend/app/models/user.py - Seed Database Fresh v3 with 7 Roles
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.core.security import get_password_hash
from app.core.rbac import Role

class UserInDB(BaseModel):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    role: str  # admin, sales_manager, sales, warehouse, warehouse_manager, accountant, purchasing
    hashed_password: str
    branch: Optional[str] = "Kho Tổng Hà Nội"
    is_active: bool = True
    status: str = "ACTIVE"  # ACTIVE | LOCKED
    lock_reason: Optional[str] = None
    locked_at: Optional[datetime] = None
    failed_attempts: int = 0
    locked_until: Optional[datetime] = None
    token_version: int = 1

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
        hashed_password=DEFAULT_HASH,
        branch="Trụ sở chính",
    ),
}

def get_next_user_id() -> int:
    """Tự động sinh ID tăng dần cho user mới."""
    if not USERS_DB:
        return 1
    return max(u.id for u in USERS_DB.values()) + 1

