# backend/tests/conftest.py
import pytest
from app.db.init_db import init_db
from app.core.database import SessionLocal
from app.models.entities import UserEntity
from app.core.security import get_password_hash
from app.models.user import load_users_db

@pytest.fixture(autouse=True)
def reset_test_state():
    """Reset database and memory state before each test run."""
    db = SessionLocal()
    try:
        # Xóa các user phụ được tạo trong lúc test
        db.query(UserEntity).filter(
            UserEntity.username.in_(["sales_moi", "admin2", "multi_role_user", "kho_invalid_branch", "kho_valid_branch", "temp_user"])
        ).delete(synchronize_session=False)

        # Đặt lại trạng thái ACTIVE, vai trò gốc và mật khẩu chuẩn '123' cho các user hệ thống
        h = get_password_hash("123")
        system_roles_map = {
            "admin": ("admin", ["admin"], "Toàn quốc"),
            "sales_manager": ("sales_manager", ["sales_manager"], "Toàn quốc"),
            "sales": ("sales", ["sales"], "Khu vực Miền Bắc"),
            "kho": ("warehouse", ["warehouse"], "Kho Tổng Hà Nội"),
            "warehouse_mgr": ("warehouse_manager", ["warehouse_manager"], "Kho Tổng Hà Nội"),
            "ketoan": ("accountant", ["accountant"], "Trụ sở chính"),
            "muahang": ("purchasing", ["purchasing"], "Trụ sở chính"),
        }
        for u in db.query(UserEntity).filter(UserEntity.username.in_(list(system_roles_map.keys()))).all():
            u.hashed_password = h
            u.failed_attempts = 0
            u.locked_until = None
            u.is_active = True
            u.status = "ACTIVE"
            u.lock_reason = None
            u.locked_at = None
            u.token_version = 1
            if u.username in system_roles_map:
                primary, r_list, branch = system_roles_map[u.username]
                u.role = primary
                u.roles = r_list
                u.branch = branch
        db.commit()
    finally:
        db.close()
    
    # Đồng bộ lại USERS_DB
    load_users_db()
    yield

