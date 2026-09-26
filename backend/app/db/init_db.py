# backend/app/db/init_db.py
import json
import os
from sqlalchemy import text
from app.core.database import engine, Base, SessionLocal
from app.models.entities import (
    UserEntity,
    ProductEntity,
    DealerEntity,
    InventoryTransactionEntity,
    OrderEntity,
)
from app.core.security import get_password_hash
from app.core.rbac import Role

def init_db():
    print("Initializing Database tables in Microsoft SQL Server...")
    # Tạo các bảng nếu chưa có
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")

    db = SessionLocal()
    try:
        # 1. Seed Users nếu bảng đang trống
        if db.query(UserEntity).count() == 0:
            print("Seeding initial users into SQL Server...")
            # Kiểm tra xem có file users_data.json để migrate dữ liệu cũ không
            json_path = os.path.join(os.path.dirname(__file__), "..", "models", "users_data.json")
            if os.path.exists(json_path):
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for k, u in data.items():
                        user_obj = UserEntity(
                            id=u.get("id"),
                            username=u.get("username"),
                            full_name=u.get("full_name"),
                            email=u.get("email"),
                            phone=u.get("phone"),
                            role=u.get("role"),
                            roles_json=json.dumps(u.get("roles", [u.get("role")])),
                            hashed_password=u.get("hashed_password"),
                            branch=u.get("branch", "Kho Tổng Hà Nội"),
                            is_active=u.get("is_active", True),
                            status=u.get("status", "ACTIVE"),
                            lock_reason=u.get("lock_reason"),
                            failed_attempts=u.get("failed_attempts", 0),
                            token_version=u.get("token_version", 1),
                        )
                        db.add(user_obj)
            db.commit()
            print("Users seeded successfully.")

        # 2. Seed Products nếu chưa có
        if db.query(ProductEntity).count() == 0:
            print("Seeding initial products into SQL Server...")
            initial_products = [
                ProductEntity(id=1, code="SP001", name="Áo thun Polo Nam Cao Cấp", category="Thời trang", stock=120, cost_price=85000.0, sell_price=199000.0),
                ProductEntity(id=2, code="SP002", name="Quần Jeans Slimfit Co Giãn", category="Thời trang", stock=45, cost_price=160000.0, sell_price=380000.0),
                ProductEntity(id=3, code="SP003", name="Áo khoác Bomber Chống Nước", category="Thời trang", stock=30, cost_price=220000.0, sell_price=490000.0),
                ProductEntity(id=4, code="SP004", name="Giày Sneaker ThThể Thao", category="Giày dép", stock=65, cost_price=310000.0, sell_price=650000.0),
                ProductEntity(id=5, code="SP005", name="Thắt lưng da bò nguyên tấm", category="Phụ kiện", stock=80, cost_price=95000.0, sell_price=250000.0),
            ]
            db.add_all(initial_products)
            db.commit()
            print("Products seeded successfully.")

        # 3. Seed Dealers nếu chưa có
        if db.query(DealerEntity).count() == 0:
            print("Seeding initial dealers into SQL Server...")
            initial_dealers = [
                DealerEntity(id=1, code="DL001", name="Đại Lý Phân Phối Miền Bắc - Sao Mai", phone="0912345678", email="saomai@daily.vn", address="120 Cầu Giấy, Hà Nội", assigned_sale_id=3),
                DealerEntity(id=2, code="DL002", name="Đại Lý Thời Trang Tân Bình", phone="0987654321", email="tanbinh@daily.vn", address="45 Lý Thường Kiệt, TP. HCM", assigned_sale_id=3),
                DealerEntity(id=3, code="DL003", name="Đại Lý Tổng Hợp Hải Phòng", phone="0934567890", email="haiphong@daily.vn", address="88 Lạch Tray, Hải Phòng", assigned_sale_id=3),
                DealerEntity(id=4, code="DL004", name="Công Ty TNHH Bán Lẻ An Phát", phone="0945678901", email="anphat@daily.vn", address="66 Nguyễn Huệ, Đà Nẵng", assigned_sale_id=2),
            ]
            db.add_all(initial_dealers)
            db.commit()
            print("Dealers seeded successfully.")

    except Exception as e:
        db.rollback()
        print(f"Error during init_db: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
