# backend/app/models/discount.py
"""
Data model and in-memory store for Volume-Based Discount Policies (Chính sách chiết khấu theo sản lượng).
Cho phép Quản lý kinh doanh (sales_manager) khai báo các bậc chiết khấu theo số lượng (tiers)
để khuyến khích đại lý lấy nhiều hàng mà không phải đàm phán thủ công từng lần.
"""
import os
import json
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field

DB_FILE_PATH = os.path.join(os.path.dirname(__file__), "discounts_data.json")

class DiscountTier(BaseModel):
    id: Optional[int] = None
    min_quantity: int = Field(..., gt=0, description="Sản lượng tối thiểu để đạt bậc chiết khấu")
    max_quantity: Optional[int] = Field(None, description="Sản lượng tối đa của bậc (None nghĩa là không giới hạn trên)")
    discount_percent: float = Field(..., gt=0, le=100, description="Tỷ lệ chiết khấu (%)")

class DiscountPolicy(BaseModel):
    id: int
    code: str
    name: str
    category: str = "ALL"  # ALL hoặc tên danh mục: "Thời trang", "Giày dép", "Phụ kiện"
    target_dealer_type: str = "ALL"  # ALL, WHOLESALE, RETAIL
    description: Optional[str] = None
    is_active: bool = True
    tiers: List[DiscountTier] = Field(default_factory=list)
    created_by: str = "sales_manager"
    created_at: str
    updated_at: str

# Dữ liệu khởi tạo mẫu thực tế cho các chính sách chiết khấu sản lượng
INITIAL_DISCOUNTS: dict[int, DiscountPolicy] = {
    1: DiscountPolicy(
        id=1,
        code="CK-SL01",
        name="Chiết khấu sản lượng Thời trang cao cấp",
        category="Thời trang",
        target_dealer_type="ALL",
        description="Áp dụng cho đại lý nhập số lượng lớn mặt hàng thời trang (Áo polo, Quần jeans, Áo khoác). Không cần thỏa thuận miệng.",
        is_active=True,
        tiers=[
            DiscountTier(id=1, min_quantity=10, max_quantity=49, discount_percent=5.0),
            DiscountTier(id=2, min_quantity=50, max_quantity=99, discount_percent=10.0),
            DiscountTier(id=3, min_quantity=100, max_quantity=199, discount_percent=15.0),
            DiscountTier(id=4, min_quantity=200, max_quantity=None, discount_percent=20.0),
        ],
        created_by="Phạm Trưởng Phòng Sales (sales_manager)",
        created_at="2026-09-15T08:00:00Z",
        updated_at="2026-10-01T10:00:00Z",
    ),
    2: DiscountPolicy(
        id=2,
        code="CK-SL02",
        name="Chính sách sỉ Giày dép & Thể thao",
        category="Giày dép",
        target_dealer_type="ALL",
        description="Khuyến khích các đại lý gom đơn giày sneaker thể thao theo số lượng lớn mỗi đợt.",
        is_active=True,
        tiers=[
            DiscountTier(id=1, min_quantity=5, max_quantity=19, discount_percent=4.0),
            DiscountTier(id=2, min_quantity=20, max_quantity=49, discount_percent=8.0),
            DiscountTier(id=3, min_quantity=50, max_quantity=None, discount_percent=12.0),
        ],
        created_by="Phạm Trưởng Phòng Sales (sales_manager)",
        created_at="2026-09-20T09:30:00Z",
        updated_at="2026-10-01T11:00:00Z",
    ),
    3: DiscountPolicy(
        id=3,
        code="CK-SL03",
        name="Chính sách Đại lý Phân phối Toàn quốc",
        category="ALL",
        target_dealer_type="ALL",
        description="Chính sách chiết khấu bậc thang tối ưu cho các Tổng kho và Đại lý cấp 1 gom đơn hỗn hợp.",
        is_active=True,
        tiers=[
            DiscountTier(id=1, min_quantity=30, max_quantity=99, discount_percent=6.0),
            DiscountTier(id=2, min_quantity=100, max_quantity=299, discount_percent=12.0),
            DiscountTier(id=3, min_quantity=300, max_quantity=None, discount_percent=18.0),
        ],
        created_by="Nguyễn Quản Trị (admin)",
        created_at="2026-09-01T08:00:00Z",
        updated_at="2026-09-01T08:00:00Z",
    ),
}

DISCOUNTS_DB: dict[int, DiscountPolicy] = {}

def get_next_discount_id() -> int:
    if not DISCOUNTS_DB:
        return 1
    return max(DISCOUNTS_DB.keys()) + 1

def save_discounts_db():
    """Lưu DISCOUNTS_DB ra file JSON dự phòng."""
    try:
        data = {str(k): v.model_dump(mode="json") for k, v in DISCOUNTS_DB.items()}
        with open(DB_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[DISCOUNTS] Lỗi khi lưu file JSON: {e}")

def load_discounts_db():
    """Nạp dữ liệu chính sách chiết khấu từ JSON hoặc nạp dữ liệu mẫu."""
    global DISCOUNTS_DB
    if os.path.exists(DB_FILE_PATH):
        try:
            with open(DB_FILE_PATH, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
                DISCOUNTS_DB.clear()
                for k, v in raw_data.items():
                    DISCOUNTS_DB[int(k)] = DiscountPolicy(**v)
                return
        except Exception as e:
            print(f"[DISCOUNTS] Lỗi khi đọc file JSON, fallback sang mẫu: {e}")

    DISCOUNTS_DB.clear()
    for k, v in INITIAL_DISCOUNTS.items():
        DISCOUNTS_DB[k] = v.model_copy(deep=True)
    save_discounts_db()

# Tự động nạp khi import
load_discounts_db()
