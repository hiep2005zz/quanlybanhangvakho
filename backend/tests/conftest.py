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

        # Đặt lại trạng thái ACTIVE và mật khẩu chuẩn '123' cho các user hệ thống
        h = get_password_hash("123")
        system_users = ["admin", "sales_manager", "sales", "kho", "warehouse_mgr", "ketoan", "muahang"]
        for u in db.query(UserEntity).filter(UserEntity.username.in_(system_users)).all():
            u.hashed_password = h
            u.failed_attempts = 0
            u.locked_until = None
            u.is_active = True
            u.status = "ACTIVE"
            u.lock_reason = None
            u.locked_at = None
        db.commit()
    finally:
        db.close()
    
    # Đồng bộ lại USERS_DB
    load_users_db()
    yield
