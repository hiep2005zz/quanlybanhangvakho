# backend/app/schemas/product.py
from typing import Optional
from pydantic import BaseModel

class ProductItem(BaseModel):
    id: int
    code: str
    name: str
    category: str
    stock: int
    sell_price: float
    cost_price: Optional[float] = None  # None if user does not have admin role

class ProductListResponse(BaseModel):
    items: list[ProductItem]
    total: int
    user_role: str
    is_cost_price_visible: bool
