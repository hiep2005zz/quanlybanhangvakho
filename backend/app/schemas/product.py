# backend/app/schemas/product.py
from typing import Optional, List, Dict
from pydantic import BaseModel

class ProductItem(BaseModel):
    id: int
    code: str
    name: str
    category: str
    stock: int
    sell_price: float
    # Dữ liệu nhạy cảm (AC 3: Bị lọc bỏ hoàn toàn nếu không phải Admin hoặc Sales Manager)
    cost_price: Optional[float] = None
    profit_margin: Optional[float] = None
    profit_per_unit: Optional[float] = None

class ProductFinancialSummary(BaseModel):
    total_products: int
    total_stock: int
    total_sell_value: float
    total_cost_value: Optional[float] = None
    total_gross_profit: Optional[float] = None
    average_margin_percent: Optional[float] = None

class ProductListResponse(BaseModel):
    items: List[ProductItem]
    total: int
    user_role: str
    is_cost_price_visible: bool
    summary: Optional[ProductFinancialSummary] = None
