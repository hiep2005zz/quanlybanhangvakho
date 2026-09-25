# backend/app/api/v1/endpoints/inventory.py
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import require_permission
from app.core.rbac import Permission
from app.schemas.auth import UserResponse
from app.schemas.inventory import (
    StockAdjustRequest,
    StockReceiptRequest,
    StockIssueRequest,
    StockUpdateRequest,
    InventoryResponse,
    InventoryTransaction,
)
from app.api.v1.endpoints.products import RAW_PRODUCTS

router = APIRouter()

# Mock transactions log in-memory
INVENTORY_TRANSACTIONS: List[InventoryTransaction] = [
    InventoryTransaction(
        id=1,
        product_id=1,
        product_name="Áo thun Polo Nam Cao Cấp",
        type="receipt",
        quantity=50,
        previous_stock=70,
        new_stock=120,
        performed_by="kho",
        user_role="warehouse",
        reason="Nhập kho định kỳ đầu tháng từ xưởng may",
        created_at="2026-09-20 08:30:00",
    ),
    InventoryTransaction(
        id=2,
        product_id=2,
        product_name="Quần Jeans Slimfit Co Giãn",
        type="issue",
        quantity=15,
        previous_stock=60,
        new_stock=45,
        performed_by="kho",
        user_role="warehouse",
        reason="Xuất hàng giao đại lý miền Trung",
        created_at="2026-09-22 14:15:00",
    ),
]


def _find_product(product_id: int):
    for p in RAW_PRODUCTS:
        if p["id"] == product_id:
            return p
    return None


@router.get("/transactions", response_model=List[InventoryTransaction])
def get_inventory_transactions(
    current_user: UserResponse = Depends(require_permission(Permission.INVENTORY_READ.value))
):
    """
    Xem lịch sử biến động kho.
    Yêu cầu quyền 'inventory:read'.
    """
    return INVENTORY_TRANSACTIONS


@router.post("/adjust", response_model=InventoryResponse)
def adjust_stock(
    data: StockAdjustRequest,
    current_user: UserResponse = Depends(require_permission(Permission.INVENTORY_WRITE.value))
):
    """
    Điều chỉnh tồn kho (Kiểm kê, cân đối kho).
    AC 4: CHẶN TUYỆT ĐỐI NHÂN VIÊN KINH DOANH (Sales).
    Nếu Sales gửi request -> require_permission bắn lỗi 403 Forbidden ngay tại Backend.
    """
    product = _find_product(data.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sản phẩm có ID {data.product_id}."
        )

    previous_stock = product["stock"]
    new_stock = previous_stock + data.adjustment
    if new_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số lượng điều chỉnh khiến tồn kho âm ({new_stock}). Không thể thực hiện."
        )

    product["stock"] = new_stock

    tx = InventoryTransaction(
        id=len(INVENTORY_TRANSACTIONS) + 1,
        product_id=product["id"],
        product_name=product["name"],
        type="adjust",
        quantity=data.adjustment,
        previous_stock=previous_stock,
        new_stock=new_stock,
        performed_by=current_user.username,
        user_role=current_user.role,
        reason=data.reason,
        created_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    )
    INVENTORY_TRANSACTIONS.insert(0, tx)

    return InventoryResponse(
        status="success",
        message=f"Đã điều chỉnh tồn kho sản phẩm '{product['name']}' thành công từ {previous_stock} sang {new_stock}.",
        product_id=product["id"],
        current_stock=new_stock,
        transaction=tx,
    )


@router.post("/receipt", response_model=InventoryResponse)
def create_stock_receipt(
    data: StockReceiptRequest,
    current_user: UserResponse = Depends(require_permission(Permission.INVENTORY_WRITE.value))
):
    """
    Lập phiếu nhập kho hàng hóa.
    AC 4: Yêu cầu quyền 'inventory:write'. Sales không có quyền -> 403 Forbidden.
    """
    product = _find_product(data.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sản phẩm có ID {data.product_id}."
        )

    previous_stock = product["stock"]
    new_stock = previous_stock + data.quantity
    product["stock"] = new_stock

    reason_str = f"Nhập kho từ NCC: {data.supplier}. {data.note or ''}".strip()
    tx = InventoryTransaction(
        id=len(INVENTORY_TRANSACTIONS) + 1,
        product_id=product["id"],
        product_name=product["name"],
        type="receipt",
        quantity=data.quantity,
        previous_stock=previous_stock,
        new_stock=new_stock,
        performed_by=current_user.username,
        user_role=current_user.role,
        reason=reason_str,
        created_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    )
    INVENTORY_TRANSACTIONS.insert(0, tx)

    return InventoryResponse(
        status="success",
        message=f"Nhập kho thành công {data.quantity} sản phẩm '{product['name']}'. Tồn kho hiện tại: {new_stock}.",
        product_id=product["id"],
        current_stock=new_stock,
        transaction=tx,
    )


@router.post("/issue", response_model=InventoryResponse)
def create_stock_issue(
    data: StockIssueRequest,
    current_user: UserResponse = Depends(require_permission(Permission.INVENTORY_WRITE.value))
):
    """
    Lập phiếu xuất kho hàng hóa.
    AC 4: Yêu cầu quyền 'inventory:write'. Sales không có quyền -> 403 Forbidden.
    """
    product = _find_product(data.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sản phẩm có ID {data.product_id}."
        )

    previous_stock = product["stock"]
    if previous_stock < data.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không đủ tồn kho để xuất. Tồn hiện tại: {previous_stock}, yêu cầu xuất: {data.quantity}."
        )

    new_stock = previous_stock - data.quantity
    product["stock"] = new_stock

    reason_str = f"Xuất kho tới: {data.destination}. {data.note or ''}".strip()
    tx = InventoryTransaction(
        id=len(INVENTORY_TRANSACTIONS) + 1,
        product_id=product["id"],
        product_name=product["name"],
        type="issue",
        quantity=-data.quantity,
        previous_stock=previous_stock,
        new_stock=new_stock,
        performed_by=current_user.username,
        user_role=current_user.role,
        reason=reason_str,
        created_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    )
    INVENTORY_TRANSACTIONS.insert(0, tx)

    return InventoryResponse(
        status="success",
        message=f"Xuất kho thành công {data.quantity} sản phẩm '{product['name']}'. Tồn kho còn lại: {new_stock}.",
        product_id=product["id"],
        current_stock=new_stock,
        transaction=tx,
    )


@router.put("/{product_id}/stock", response_model=InventoryResponse)
def update_stock_quantity(
    product_id: int,
    data: StockUpdateRequest,
    current_user: UserResponse = Depends(require_permission(Permission.INVENTORY_WRITE.value))
):
    """
    Cập nhật trực tiếp số lượng tồn kho (PUT).
    AC 4: Chặn các thao tác PUT đối với Nhân viên kinh doanh -> 403 Forbidden.
    """
    product = _find_product(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sản phẩm có ID {product_id}."
        )

    previous_stock = product["stock"]
    product["stock"] = data.new_stock

    tx = InventoryTransaction(
        id=len(INVENTORY_TRANSACTIONS) + 1,
        product_id=product["id"],
        product_name=product["name"],
        type="stock_count",
        quantity=data.new_stock - previous_stock,
        previous_stock=previous_stock,
        new_stock=data.new_stock,
        performed_by=current_user.username,
        user_role=current_user.role,
        reason=f"Cập nhật trực tiếp tồn kho: {data.reason}",
        created_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    )
    INVENTORY_TRANSACTIONS.insert(0, tx)

    return InventoryResponse(
        status="success",
        message=f"Đã cập nhật số lượng tồn kho sản phẩm '{product['name']}' thành {data.new_stock}.",
        product_id=product["id"],
        current_stock=data.new_stock,
        transaction=tx,
    )


@router.delete("/{product_id}/stock", response_model=InventoryResponse)
def clear_stock_quantity(
    product_id: int,
    current_user: UserResponse = Depends(require_permission(Permission.INVENTORY_WRITE.value))
):
    """
    Xóa/Reset tồn kho sản phẩm về 0 (DELETE).
    AC 4: Chặn các thao tác DELETE đối với Nhân viên kinh doanh -> 403 Forbidden.
    """
    product = _find_product(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sản phẩm có ID {product_id}."
        )

    previous_stock = product["stock"]
    product["stock"] = 0

    tx = InventoryTransaction(
        id=len(INVENTORY_TRANSACTIONS) + 1,
        product_id=product["id"],
        product_name=product["name"],
        type="adjust",
        quantity=-previous_stock,
        previous_stock=previous_stock,
        new_stock=0,
        performed_by=current_user.username,
        user_role=current_user.role,
        reason="Thao tác DELETE: Đặt lại tồn kho về 0",
        created_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    )
    INVENTORY_TRANSACTIONS.insert(0, tx)

    return InventoryResponse(
        status="success",
        message=f"Đã reset tồn kho của '{product['name']}' về 0.",
        product_id=product["id"],
        current_stock=0,
        transaction=tx,
    )
