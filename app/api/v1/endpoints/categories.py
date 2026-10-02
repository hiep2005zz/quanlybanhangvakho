from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import require_permission, get_current_user, require_roles
from app.core.database import get_db
from app.core.rbac import Permission, Role
from app.models.entities import CategoryEntity, ProductEntity
from app.schemas.auth import UserResponse
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse, CategoryTreeResponse

router = APIRouter()

def build_category_tree(categories: List[CategoryEntity], parent_id: Optional[int] = None) -> List[CategoryTreeResponse]:
    tree = []
    for cat in categories:
        if cat.parent_id == parent_id:
            node = CategoryTreeResponse(
                id=cat.id,
                name=cat.name,
                parent_id=cat.parent_id,
                description=cat.description,
                sub_categories=build_category_tree(categories, cat.id)
            )
            tree.append(node)
    return tree

@router.get("/tree", response_model=List[CategoryTreeResponse])
def get_categories_tree(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_roles([Role.SYSTEM_ADMIN.value, Role.SALES_MANAGER.value]))
):
    categories = db.query(CategoryEntity).all()
    return build_category_tree(categories)

@router.get("", response_model=List[CategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_roles([Role.SYSTEM_ADMIN.value, Role.SALES_MANAGER.value]))
):
    return db.query(CategoryEntity).all()

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_roles([Role.SYSTEM_ADMIN.value, Role.SALES_MANAGER.value]))
):
    if data.parent_id:
        parent = db.query(CategoryEntity).filter(CategoryEntity.id == data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Danh mục cha không tồn tại.")
            
    existing = db.query(CategoryEntity).filter(CategoryEntity.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tên danh mục đã tồn tại.")

    cat = CategoryEntity(**data.dict())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_roles([Role.SYSTEM_ADMIN.value, Role.SALES_MANAGER.value]))
):
    cat = db.query(CategoryEntity).filter(CategoryEntity.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục.")
        
    if data.parent_id and data.parent_id == category_id:
        raise HTTPException(status_code=400, detail="Không thể chọn chính nó làm danh mục cha.")

    if data.parent_id:
        parent = db.query(CategoryEntity).filter(CategoryEntity.id == data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Danh mục cha không tồn tại.")
            
    existing = db.query(CategoryEntity).filter(CategoryEntity.name == data.name, CategoryEntity.id != category_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tên danh mục đã tồn tại.")

    for key, value in data.dict().items():
        setattr(cat, key, value)
        
    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_roles([Role.SYSTEM_ADMIN.value, Role.SALES_MANAGER.value]))
):
    """
    Ràng buộc an toàn khi xóa danh mục: Nếu danh mục đó vẫn chứa sản phẩm HOẶC vẫn còn các nhóm con, tuyệt đối KHÔNG CHO PHÉP XÓA.
    """
    cat = db.query(CategoryEntity).filter(CategoryEntity.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục.")
        
    # Check sub-categories
    sub_cats = db.query(CategoryEntity).filter(CategoryEntity.parent_id == category_id).count()
    if sub_cats > 0:
        raise HTTPException(status_code=400, detail="Không thể xóa danh mục vì vẫn còn các nhóm con.")
        
    # Check products
    products_count = db.query(ProductEntity).filter(ProductEntity.category_id == category_id).count()
    if products_count > 0:
        raise HTTPException(status_code=400, detail="Không thể xóa danh mục vì vẫn còn sản phẩm thuộc nhóm này.")
        
    # Also check RAW_PRODUCTS mock data for consistency since products.py uses it
    from app.api.v1.endpoints.products import RAW_PRODUCTS
    for p in RAW_PRODUCTS:
        if p.get("category_id") == category_id:
            raise HTTPException(status_code=400, detail="Không thể xóa danh mục vì vẫn còn sản phẩm thuộc nhóm này trong Mock Data.")
            
    db.delete(cat)
    db.commit()
    return {"status": "success", "message": "Xóa danh mục thành công"}

@router.get("/sales-report")
def get_category_sales_report(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_roles([Role.SYSTEM_ADMIN.value, Role.SALES_MANAGER.value]))
):
    """
    Báo cáo doanh số theo ngành hàng.
    Tổng hợp doanh số lũy kế từ các nhóm con lên nhóm cha.
    """
    categories = db.query(CategoryEntity).all()
    # Tính doanh số từ RAW_PRODUCTS 
    from app.api.v1.endpoints.products import RAW_PRODUCTS
    
    # Doanh số trực tiếp cho mỗi category
    direct_sales = {cat.id: 0.0 for cat in categories}
    direct_sales[None] = 0.0
    
    for p in RAW_PRODUCTS:
        cid = p.get("category_id")
        stock = p.get("stock", 0)
        sell_price = p.get("sell_price", 0.0)
        # Using stock * sell_price as a mock for sales, or we should use ORDERS_DB for actual sales!
        # Wait, the instruction says "Báo cáo doanh số theo ngành hàng". If we use stock*sell_price, that's inventory value. 
        pass
    
    # Calculate real sales from orders
    from app.api.v1.endpoints.orders import ORDERS_DB
    
    product_sales = {}
    for order_id, order in ORDERS_DB.items():
        if order.get("status") not in ["CANCELLED"]:
            for item in order.get("items", []):
                pid = item.get("product_id")
                qty = item.get("quantity", 0)
                price = item.get("price", 0.0)
                product_sales[pid] = product_sales.get(pid, 0.0) + (qty * price)
                
    direct_sales = {cat.id: 0.0 for cat in categories}
    direct_sales[None] = 0.0
    
    for p in RAW_PRODUCTS:
        pid = p.get("id")
        cid = p.get("category_id")
        if pid in product_sales:
            if cid in direct_sales:
                direct_sales[cid] += product_sales[pid]
            else:
                direct_sales[None] += product_sales[pid]

    # hierarchical calculation
    # We need to build a graph from bottom to top, or recursively sum
    def get_descendants_sales(cat_id):
        total = direct_sales.get(cat_id, 0.0)
        for cat in categories:
            if cat.parent_id == cat_id:
                total += get_descendants_sales(cat.id)
        return total
        
    report = []
    for cat in categories:
        report.append({
            "id": cat.id,
            "name": cat.name,
            "parent_id": cat.parent_id,
            "direct_sales": direct_sales.get(cat.id, 0.0),
            "total_sales": get_descendants_sales(cat.id)
        })
        
    return report
