# backend/app/models/entities.py
from datetime import datetime, timezone
import json
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    Unicode,
    UnicodeText,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def get_utc_now():
    return datetime.now(timezone.utc)

class UserEntity(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(Unicode(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    role = Column(String(50), nullable=False)
    roles_json = Column(UnicodeText, nullable=True)  # JSON string lưu danh sách roles
    hashed_password = Column(String(255), nullable=False)
    branch = Column(Unicode(100), default="Kho Tổng Hà Nội")
    is_active = Column(Boolean, default=True)
    status = Column(String(20), default="ACTIVE")  # ACTIVE | LOCKED
    lock_reason = Column(Unicode(500), nullable=True)
    locked_at = Column(DateTime, nullable=True)
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    token_version = Column(Integer, default=1)
    created_at = Column(DateTime, default=get_utc_now)

    @property
    def roles(self) -> list[str]:
        if self.roles_json:
            try:
                return json.loads(self.roles_json)
            except Exception:
                pass
        return [self.role] if self.role else []

    @roles.setter
    def roles(self, val: list[str]):
        self.roles_json = json.dumps(val or [])

    def get_roles(self) -> list[str]:
        r = self.roles
        if r and len(r) > 0:
            return r
        return [self.role] if self.role else []


class ProductEntity(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(Unicode(255), nullable=False)
    category = Column(Unicode(100), default="Thời trang")
    stock = Column(Integer, default=0)
    cost_price = Column(Float, default=0.0)
    sell_price = Column(Float, default=0.0)
    created_at = Column(DateTime, default=get_utc_now)


class DealerEntity(Base):
    __tablename__ = "dealers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(Unicode(255), nullable=False)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Unicode(500), nullable=True)
    assigned_sale_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=get_utc_now)


class InventoryTransactionEntity(Base):
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    product_name = Column(Unicode(255), nullable=False)
    type = Column(String(50), nullable=False)  # receipt, issue, adjust
    quantity = Column(Integer, nullable=False)
    previous_stock = Column(Integer, nullable=False)
    new_stock = Column(Integer, nullable=False)
    performed_by = Column(Unicode(100), nullable=False)
    user_role = Column(String(50), nullable=False)
    reason = Column(UnicodeText, nullable=True)
    created_at = Column(DateTime, default=get_utc_now)


class OrderEntity(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_code = Column(String(50), unique=True, index=True, nullable=False)
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=False)
    dealer_name = Column(Unicode(255), nullable=False)
    created_by = Column(Unicode(100), nullable=False)
    assigned_sale_id = Column(Integer, nullable=True)
    assigned_sale_name = Column(Unicode(255), nullable=True)
    total_amount = Column(Float, default=0.0)
    status = Column(String(50), default="PENDING")
    note = Column(UnicodeText, nullable=True)
    items_json = Column(UnicodeText, nullable=True)  # JSON order items
    created_at = Column(DateTime, default=get_utc_now)
