# backend/app/schemas/discount.py
from typing import Optional, List
from pydantic import BaseModel, Field

class DiscountTierSchema(BaseModel):
    id: Optional[int] = None
    min_quantity: int = Field(..., gt=0, description="Sản lượng tối thiểu đạt mốc")
    max_quantity: Optional[int] = Field(None, description="Sản lượng tối đa của mốc (để trống nếu từ mức này trở lên)")
    discount_percent: float = Field(..., gt=0, le=100, description="Tỷ lệ chiết khấu (%)")

class DiscountPolicyCreate(BaseModel):
    code: Optional[str] = None
    name: str = Field(..., min_length=3, description="Tên chính sách chiết khấu")
    category: str = Field(default="ALL", description="Danh mục áp dụng: 'ALL' hoặc 'Thời trang', 'Giày dép'...")
    target_dealer_type: str = Field(default="ALL", description="Đối tượng áp dụng: 'ALL' hoặc 'WHOLESALE'...")
    description: Optional[str] = None
    is_active: bool = True
    tiers: List[DiscountTierSchema] = Field(..., min_length=1, description="Các bậc chiết khấu theo số lượng")

class DiscountPolicyUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    target_dealer_type: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    tiers: Optional[List[DiscountTierSchema]] = None

class DiscountPolicyResponse(BaseModel):
    id: int
    code: str
    name: str
    category: str
    target_dealer_type: str
    description: Optional[str] = None
    is_active: bool
    tiers: List[DiscountTierSchema]
    created_by: str
    created_at: str
    updated_at: str

class DiscountListResponse(BaseModel):
    items: List[DiscountPolicyResponse]
    total: int
    can_manage: bool

class DiscountCalculateRequest(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)

class DiscountCalculateResponse(BaseModel):
    product_id: int
    product_name: str
    category: str
    quantity: int
    unit_price: float
    cost_price: Optional[float] = None
    applied_policy_id: Optional[int] = None
    applied_policy_name: Optional[str] = None
    applied_tier_label: Optional[str] = None
    discount_percent: float
    unit_discount: float
    discounted_unit_price: float
    total_original_price: float
    total_discount_amount: float
    total_final_price: float
    gross_profit: Optional[float] = None
    gross_margin_percent: Optional[float] = None
