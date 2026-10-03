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

    # Dọn sạch audit logs do các ca test sinh ra để không ảnh hưởng dữ liệu thật
    cleanup_db = SessionLocal()
    try:
        from app.models.entities import AuditLogEntity
        from app.services.audit_service import MEMORY_AUDIT_LOGS
        test_cleanup_reasons = [
            "Kiểm kê định kỳ phát hiện dư",
            "Kiểm kê định kỳ phát hiện thừa 5 cái",
            "Tăng giá theo bảng giá quý 4",
            "Nâng hạn mức tín dụng khách hàng VIP",
            "Khách hủy hợp đồng",
            "Nhập kho từ NCC: Nhà Cung Cấp Sabeco. Nhập kho theo thùng từ nhà cung cấp (2 Thùng = 48 Lon)",
            "Xuất kho tới: Đại lý Hà Nội. Xuất mẫu thử nghiệm cho khách (1 Lốc = 6 Lon)",
            "Nhập kho từ NCC: Công ty TNHH Bia Nước Giải Khát. Nhập kho lịch sử mốc 1 (3 Thùng = 72 Lon)",
            "Admin cân đối kho",
            "Test",
            "test",
        ]
        cleanup_db.query(AuditLogEntity).filter(
            (AuditLogEntity.reason.in_(test_cleanup_reasons)) |
            (AuditLogEntity.reason.like("%Sabeco%")) |
            (AuditLogEntity.reason.like("%mốc 1%")) |
            (AuditLogEntity.reason.like("%mẫu thử nghiệm%")) |
            (AuditLogEntity.user_name == "Lê Thủ Kho")
        ).delete(synchronize_session=False)
        cleanup_db.commit()
        MEMORY_AUDIT_LOGS[:] = [
            m for m in MEMORY_AUDIT_LOGS
            if m.get("reason") not in test_cleanup_reasons
            and "Sabeco" not in (m.get("reason") or "")
            and "mốc 1" not in (m.get("reason") or "")
            and "mẫu thử nghiệm" not in (m.get("reason") or "")
            and m.get("user_name") != "Lê Thủ Kho"
        ]
        # Khôi phục ĐVT chuẩn cho SP001 (Áo thun Polo: base_unit = "Cái", không để "Lon" do test đổi)
        from app.api.v1.endpoints.products import RAW_PRODUCTS
        for p in RAW_PRODUCTS:
            if p.get("code") == "SP001":
                p["base_unit"] = "Cái"
                p["units"] = [
                    {"unit_name": "Lốc", "conversion_rate": 6.0},
                    {"unit_name": "Thùng", "conversion_rate": 24.0},
                ]
            elif p.get("code") == "SP002":
                p["base_unit"] = "Chiếc"
                p["units"] = [
                    {"unit_name": "Kiện", "conversion_rate": 10.0},
                ]
    except Exception:
        cleanup_db.rollback()
    finally:
        cleanup_db.close()

