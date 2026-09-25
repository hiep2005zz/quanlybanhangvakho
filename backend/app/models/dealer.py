# backend/app/models/dealer.py
"""
Data model and in-memory store for Dealers/Customers.
Stores assigned_sale_id pointing to users.id.
"""
from typing import Optional, List
from pydantic import BaseModel

class Dealer(BaseModel):
    id: int
    code: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    assigned_sale_id: Optional[int] = None  # user id of the sales staff responsible

# Initial seed data for dealers
# Sales user: id=3 (username: 'sales', full_name: 'Trần Bán Hàng')
DEALERS_DB: dict[int, Dealer] = {
    1: Dealer(
        id=1,
        code="DL001",
        name="Đại Lý Phân Phối Miền Bắc - Sao Mai",
        phone="0912345678",
        email="saomai@daily.vn",
        address="120 Cầu Giấy, Hà Nội",
        assigned_sale_id=3,
    ),
    2: Dealer(
        id=2,
        code="DL002",
        name="Đại Lý Thời Trang Tân Bình",
        phone="0987654321",
        email="tanbinh@daily.vn",
        address="45 Lý Thường Kiệt, TP. HCM",
        assigned_sale_id=3,
    ),
    3: Dealer(
        id=3,
        code="DL003",
        name="Đại Lý Tổng Hợp Hải Phòng",
        phone="0934567890",
        email="haiphong@daily.vn",
        address="88 Lạch Tray, Hải Phòng",
        assigned_sale_id=3,
    ),
    4: Dealer(
        id=4,
        code="DL004",
        name="Công Ty TNHH Bán Lẻ An Phát",
        phone="0945678901",
        email="anphat@daily.vn",
        address="66 Nguyễn Huệ, Đà Nẵng",
        assigned_sale_id=2,  # id=2 is sales_manager
    ),
}

def count_dealers_by_sale_id(user_id: int) -> int:
    """Đếm số lượng đại lý/khách hàng do nhân viên phụ trách."""
    return sum(1 for d in DEALERS_DB.values() if d.assigned_sale_id == user_id)

def get_dealers_by_sale_id(user_id: int) -> List[Dealer]:
    """Lấy danh sách đại lý do nhân viên phụ trách."""
    return [d for d in DEALERS_DB.values() if d.assigned_sale_id == user_id]
