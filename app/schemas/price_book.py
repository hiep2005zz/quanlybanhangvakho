# backend/app/schemas/price_book.py
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

class PriceBookItemBase(BaseModel):
    product_id: int
    price: float = Field(0, ge=0)
    min_price: float = Field(0, ge=0)
    sale_price: Optional[float] = Field(None, ge=0)
    floor_price: Optional[float] = Field(None, ge=0)

class PriceBookItemCreate(PriceBookItemBase):
    pass

class PriceBookItemResponse(PriceBookItemBase):
    id: int
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    sale_price: Optional[float] = None
    floor_price: Optional[float] = None

    class Config:
        from_attributes = True

class PriceBookBase(BaseModel):
    name: str
    customer_group: str
    valid_from: datetime
    valid_to: datetime
    note: Optional[str] = None
    status: str = "ACTIVE"

class PriceBookCreate(PriceBookBase):
    code: str
    items: List[PriceBookItemCreate]

class PriceBookUpdate(BaseModel):
    name: Optional[str] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    status: Optional[str] = None
    note: Optional[str] = None
    items: Optional[List[PriceBookItemCreate]] = None



class PriceBookResponse(PriceBookBase):
    id: int
    code: str
    created_by: str
    created_at: datetime
    items: Optional[List[PriceBookItemResponse]] = None

    class Config:
        from_attributes = True

class OrderItemValidationRequest(BaseModel):
    product_id: int
    price: float = Field(..., ge=0)
    quantity: int = Field(..., gt=0)

class OrderPriceValidationRequest(BaseModel):
    dealer_id: int
    items: List[OrderItemValidationRequest]

class OrderItemEvaluation(BaseModel):
    product_id: int
    product_code: Optional[str] = None
    actual_price: float
    book_price: float
    min_price: float
    sale_price: Optional[float] = None
    floor_price: Optional[float] = None
    is_below_min: bool

class OrderPriceValidationResponse(BaseModel):
    price_book_id: Optional[int]
    price_book_code: Optional[str]
    requires_approval: bool
    approval_status: str
    approval_reason: Optional[str]
    items_evaluation: List[OrderItemEvaluation]
