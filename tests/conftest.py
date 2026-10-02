import json
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

        # Xóa các sản phẩm test được tạo trong lúc test
        from app.models.entities import ProductEntity
        db.query(ProductEntity).filter(
            ProductEntity.code.in_(["SP_CONFIRM_NEW_99", "SP_TEST_NEW_01", "SP_TEST_02", "SP_TEST_03", "SP_TEST_04", "SP_TRUNG_01"])
        ).delete(synchronize_session=False)
        from app.api.v1.endpoints.products import RAW_PRODUCTS
        RAW_PRODUCTS[:] = [p for p in RAW_PRODUCTS if p.get("code") not in ["SP_CONFIRM_NEW_99", "SP_TEST_NEW_01", "SP_TEST_02", "SP_TEST_03", "SP_TEST_04", "SP_TRUNG_01"]]
        db.commit()

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
        existing_db_users = {u.username: u for u in db.query(UserEntity).filter(UserEntity.username.in_(list(system_roles_map.keys()))).all()}
        for uname, (primary, r_list, branch) in system_roles_map.items():
            if uname in existing_db_users:
                u = existing_db_users[uname]
                u.hashed_password = h
                u.failed_attempts = 0
                u.locked_until = None
                u.is_active = True
                u.status = "ACTIVE"
                u.lock_reason = None
                u.locked_at = None
                u.token_version = 1
                u.role = primary
                u.roles = r_list
                u.branch = branch
            else:
                new_u = UserEntity(
                    username=uname,
                    full_name=uname.capitalize(),
                    email=f"{uname}@congty.vn",
                    role=primary,
                    roles_json=json.dumps(r_list),
                    hashed_password=h,
                    branch=branch,
                    is_active=True,
                    status="ACTIVE",
                    token_version=1
                )
                db.add(new_u)
        db.commit()
    finally:
        db.close()
    
    # Đồng bộ lại USERS_DB và reset failed login attempts
    load_users_db()
    from app.services.auth_service import FAILED_ATTEMPTS
    FAILED_ATTEMPTS.clear()
    from app.models.dealer import DEALERS_DB
    from app.models.user import USERS_DB
    sales_uid = USERS_DB["sales"].id if "sales" in USERS_DB else 3
    mgr_uid = USERS_DB["sales_manager"].id if "sales_manager" in USERS_DB else 2
    if 1 in DEALERS_DB: DEALERS_DB[1].assigned_sale_id = sales_uid
    if 2 in DEALERS_DB: DEALERS_DB[2].assigned_sale_id = sales_uid
    if 3 in DEALERS_DB: DEALERS_DB[3].assigned_sale_id = sales_uid
    if 4 in DEALERS_DB: DEALERS_DB[4].assigned_sale_id = mgr_uid
    yield

