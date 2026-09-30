# backend/app/api/v1/endpoints/orders.py
"""
Order Management Endpoint:
AC 3: Kiểm tra nhân viên phụ trách của Đại lý đó.
Nếu tài khoản nhân viên đang ở trạng thái LOCKED, từ chối tạo đơn và báo lỗi:
"Đại lý này thuộc nhân viên đã bị khóa tài khoản, vui lòng bàn giao trước khi lên đơn".
"""
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user, require_permission
from app.core.rbac import Permission
from app.schemas.auth import UserResponse
from app.models.dealer import DEALERS_DB
from app.models.user import USERS_DB

router = APIRouter()

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    price: float = Field(..., ge=0)

class OrderCreate(BaseModel):
    dealer_id: int
    items: List[OrderItemCreate]
    note: Optional[str] = None

class OrderResponse(BaseModel):
    id: int
    order_code: str
    dealer_id: int
    dealer_name: str
    created_by: str
    assigned_sale_id: Optional[int] = None
    assigned_sale_name: Optional[str] = None
    total_amount: float
    status: str
    created_at: str

# Mock orders storage
ORDERS_DB: dict[int, dict] = {}
NEXT_ORDER_ID = 1

@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    data: OrderCreate,
    current_user: UserResponse = Depends(require_permission(Permission.ORDER_WRITE.value))
):
    global NEXT_ORDER_ID
    # 1. Tìm thông tin đại lý
    dealer = DEALERS_DB.get(data.dealer_id)
    if not dealer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đại lý có ID {data.dealer_id}."
        )

    # 2. AC 3: Kiểm tra nhân viên phụ trách của đại lý
    assigned_sale_id = dealer.assigned_sale_id
    assigned_user = None
    if assigned_sale_id:
        for u in USERS_DB.values():
            if u.id == assigned_sale_id:
                assigned_user = u
                break

    # Nếu nhân viên phụ trách bị KHÓA (LOCKED hoặc is_active = False):
    if assigned_user and (not assigned_user.is_active or getattr(assigned_user, "status", "ACTIVE") == "LOCKED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đại lý này thuộc nhân viên đã bị khóa tài khoản, vui lòng bàn giao trước khi lên đơn"
        )

    # 3. Tạo đơn hàng
    total_amount = sum(item.quantity * item.price for item in data.items)
    order_id = NEXT_ORDER_ID
    NEXT_ORDER_ID += 1
    order_code = f"ORD{order_id:05d}"
    now_str = datetime.now(timezone.utc).isoformat()

    order_record = {
        "id": order_id,
        "order_code": order_code,
        "dealer_id": dealer.id,
        "dealer_name": dealer.name,
        "created_by": current_user.username,
        "assigned_sale_id": assigned_sale_id,
        "assigned_sale_name": assigned_user.full_name if assigned_user else None,
        "total_amount": total_amount,
        "status": "CONFIRMED",
        "created_at": now_str,
    }
    ORDERS_DB[order_id] = order_record

    return OrderResponse(**order_record)
