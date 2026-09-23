# backend/app/api/v1/endpoints/products.py
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.schemas.auth import UserResponse
from app.schemas.product import ProductItem, ProductListResponse

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
def get_products(current_user: UserResponse = Depends(get_current_user)):
    """
    Get products list.
    CRITICAL SECURITY RULE:
    - If user is NOT admin (e.g. sales, warehouse), cost_price is STRIPPED (None).
    - If user IS admin, cost_price is included.
    """
    is_admin = (current_user.role == "admin")
    
    sanitized_items: list[ProductItem] = []
    for p in RAW_PRODUCTS:
        sanitized_items.append(
            ProductItem(
                id=p["id"],
                code=p["code"],
                name=p["name"],
                category=p["category"],
                stock=p["stock"],
                sell_price=p["sell_price"],
                cost_price=p["cost_price"] if is_admin else None  # Hidden on server side!
            )
        )
    
    return ProductListResponse(
        items=sanitized_items,
        total=len(sanitized_items),
        user_role=current_user.role,
        is_cost_price_visible=is_admin
    )
