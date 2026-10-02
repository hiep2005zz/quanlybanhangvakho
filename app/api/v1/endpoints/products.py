from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_permission
from app.core.database import get_db
from app.core.rbac import Permission, has_permission
from app.schemas.auth import UserResponse
from app.schemas.product import ProductItem, ProductListResponse, ProductFinancialSummary, PriceUpdateRequest
from app.services.audit_service import log_audit_event

router = APIRouter()

# Mock Products database
RAW_PRODUCTS = [
    {"id": 1, "code": "SP001", "name": "Áo thun Polo Nam Cao Cấp", "category": "Thời trang", "stock": 120, "cost_price": 85000.0, "sell_price": 199000.0},
    {"id": 2, "code": "SP002", "name": "Quần Jeans Slimfit Co Giãn", "category": "Thời trang", "stock": 45, "cost_price": 160000.0, "sell_price": 380000.0},
    {"id": 3, "code": "SP003", "name": "Áo khoác Bomber Chống Nước", "category": "Thời trang", "stock": 30, "cost_price": 220000.0, "sell_price": 490000.0},
    {"id": 4, "code": "SP004", "name": "Giày Sneaker Thể Thao", "category": "Giày dép", "stock": 65, "cost_price": 310000.0, "sell_price": 650000.0},
    {"id": 5, "code": "SP005", "name": "Thắt lưng da bò nguyên tấm", "category": "Phụ kiện", "stock": 80, "cost_price": 95000.0, "sell_price": 250000.0},
]



@router.get("", response_model=ProductListResponse)
def get_products(current_user: UserResponse = Depends(require_permission(Permission.PRODUCT_READ.value))):
    """
    Lấy danh sách sản phẩm.
    ÁP DỤNG AC 2 (Zero-Trust) & AC 3 (Bảo vệ dữ liệu nhạy cảm Giá vốn & Biên lợi nhuận):
    - Người dùng bắt buộc phải có quyền 'product:read'.
    - Dữ liệu 'cost_price' (giá vốn), 'profit_margin' (biên lợi nhuận), 'profit_per_unit' (lợi nhuận/đơn vị)
      CHỈ ĐƯỢC PHÉP TRẢ VỀ khi người dùng có quyền 'cost:read' (Vai trò: Quản lý kinh doanh hoặc Quản trị hệ thống).
    - Đối với Thủ kho, Nhân viên kinh doanh, Kế toán...: Server BÓC TÁCH & GỠ BỎ HOÀN TOÀN các trường này (None).
    """
    can_view_cost = current_user.can_view_cost or (Permission.COST_READ.value in current_user.permissions)
    
    sanitized_items: list[ProductItem] = []
    total_stock = 0
    total_sell_val = 0.0
    total_cost_val = 0.0

    for p in RAW_PRODUCTS:
        stock = p["stock"]
        sell_price = p["sell_price"]
        cost_price = p["cost_price"]

        total_stock += stock
        total_sell_val += sell_price * stock

        if can_view_cost:
            profit_unit = sell_price - cost_price
            margin = round((profit_unit / sell_price) * 100, 2) if sell_price > 0 else 0.0
            total_cost_val += cost_price * stock
            item = ProductItem(
                id=p["id"],
                code=p["code"],
                name=p["name"],
                category=p["category"],
                stock=stock,
                sell_price=sell_price,
                cost_price=cost_price,
                profit_margin=margin,
                profit_per_unit=profit_unit,
            )
        else:
            # AC 3: Filter/strip bỏ hoàn toàn trường nhạy cảm trước khi gửi JSON về client
            item = ProductItem(
                id=p["id"],
                code=p["code"],
                name=p["name"],
                category=p["category"],
                stock=stock,
                sell_price=sell_price,
                cost_price=None,
                profit_margin=None,
                profit_per_unit=None,
            )
        sanitized_items.append(item)

    if can_view_cost:
        gross_profit = total_sell_val - total_cost_val
        avg_margin = round((gross_profit / total_sell_val) * 100, 2) if total_sell_val > 0 else 0.0
        summary = ProductFinancialSummary(
            total_products=len(sanitized_items),
            total_stock=total_stock,
            total_sell_value=total_sell_val,
            total_cost_value=total_cost_val,
            total_gross_profit=gross_profit,
            average_margin_percent=avg_margin,
        )
    else:
        summary = ProductFinancialSummary(
            total_products=len(sanitized_items),
            total_stock=total_stock,
            total_sell_value=total_sell_val,
            total_cost_value=None,
            total_gross_profit=None,
            average_margin_percent=None,
        )

    return ProductListResponse(
        items=sanitized_items,
        total=len(sanitized_items),
        user_role=current_user.role,
        is_cost_price_visible=can_view_cost,
        summary=summary,
    )

@router.put("/{product_id}/stock")
@router.patch("/{product_id}/stock")
@router.put("/{product_id}")
@router.patch("/{product_id}")
def update_product_stock(
    product_id: int,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_permission(Permission.INVENTORY_WRITE.value))
):
    """
    Cập nhật số lượng tồn kho sản phẩm.
    Zero-Trust / Default Deny:
    - Bắt buộc kiểm tra quyền 'inventory:write' ở tầng server.
    - Nhân viên kinh doanh (Sales) không có quyền -> trả về 403 Forbidden ngay lập tức.
    """
    for p in RAW_PRODUCTS:
        if p["id"] == product_id:
            old_stock = p["stock"]
            if "stock" in payload:
                new_stock = int(payload["stock"])
                p["stock"] = new_stock
                log_audit_event(
                    db=db,
                    user=current_user,
                    action_type="INVENTORY_ADJUST",
                    entity_type="Product",
                    entity_id=p["code"],
                    old_val={"stock": old_stock},
                    new_val={"stock": new_stock},
                    reason=payload.get("reason", "Cập nhật tồn kho sản phẩm"),
                    request=request,
                )
            return {"status": "success", "message": "Cập nhật tồn kho thành công", "product": p}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sản phẩm")


@router.put("/{product_id}/price")
def update_product_price(
    product_id: int,
    data: PriceUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_permission(Permission.PRODUCT_WRITE.value))
):
    """
    Thay đổi giá bán niêm yết hoặc giá vốn nhập kho.
    Ghi vết vào bảng audit_logs với action_type='PRICE_CHANGE'.
    """
    for p in RAW_PRODUCTS:
        if p["id"] == product_id:
            old_val = {"sell_price": p["sell_price"], "cost_price": p["cost_price"]}
            new_val = {}
            if data.sell_price is not None:
                p["sell_price"] = data.sell_price
                new_val["sell_price"] = data.sell_price
            if data.cost_price is not None:
                p["cost_price"] = data.cost_price
                new_val["cost_price"] = data.cost_price

            log_audit_event(
                db=db,
                user=current_user,
                action_type="PRICE_CHANGE",
                entity_type="Product",
                entity_id=p["code"],
                old_val=old_val,
                new_val=new_val,
                reason=data.reason,
                request=request,
            )

            return {
                "status": "success",
                "message": f"Đã cập nhật giá cho sản phẩm {p['name']}.",
                "product": p
            }
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sản phẩm")

