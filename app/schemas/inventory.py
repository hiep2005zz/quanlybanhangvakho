# backend/app/schemas/inventory.py
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class StockAdjustRequest(BaseModel):
    product_id: int
    adjustment: int  # Số lượng thay đổi (dương hoặc âm)
    reason: str = Field(..., min_length=2, max_length=200)

class StockReceiptRequest(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    supplier: str = Field(..., min_length=2, max_length=150)
    note: Optional[str] = None

class StockIssueRequest(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    destination: str = Field(..., min_length=2, max_length=150)
    note: Optional[str] = None

class StockUpdateRequest(BaseModel):
    new_stock: int = Field(..., ge=0)
    reason: str = Field(..., min_length=2, max_length=200)

class InventoryTransaction(BaseModel):
    id: int
    product_id: int
    product_name: str
    type: str  # "receipt", "issue", "adjust", "stock_count"
    quantity: int
    previous_stock: int
    new_stock: int
    performed_by: str
    user_role: str
    reason: str
    created_at: str

class InventoryResponse(BaseModel):
    status: str = "success"
    message: str
    product_id: int
    current_stock: int
    transaction: Optional[InventoryTransaction] = None
