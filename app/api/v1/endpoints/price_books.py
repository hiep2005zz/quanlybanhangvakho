# backend/app/api/v1/endpoints/price_books.py
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_permission
from app.core.database import get_db
from app.core.rbac import Permission, Role
from app.models.price_book import PriceBookEntity, PriceBookItemEntity
from app.models.entities import DealerEntity, ProductEntity, OrderEntity
from app.schemas.price_book import (
    PriceBookCreate,
    PriceBookResponse,
    PriceBookUpdate,
    OrderPriceValidationRequest,
    OrderPriceValidationResponse,
    OrderItemEvaluation
)
from app.schemas.auth import UserResponse

router = APIRouter()

def get_utc_now():
    return datetime.now(timezone.utc)

@router.post("", response_model=PriceBookResponse, status_code=status.HTTP_201_CREATED)
def create_price_book(
    data: PriceBookCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_permission([Role.SYSTEM_ADMIN, Role.SALES_MANAGER, Role.ACCOUNTANT]))
):
    # Check if code exists
    if db.query(PriceBookEntity).filter(PriceBookEntity.code == data.code).first():
        raise HTTPException(status_code=400, detail="Mã bảng giá đã tồn tại.")

    new_pb = PriceBookEntity(
        code=data.code,
        name=data.name,
        customer_group=data.customer_group,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
        status=data.status,
        note=data.note,
        created_by=current_user.username
    )
    db.add(new_pb)
    db.flush()

    for item in data.items:
        pb_item = PriceBookItemEntity(
            price_book_id=new_pb.id,
            product_id=item.product_id,
            price=item.price,
            min_price=item.min_price,
            sale_price=item.sale_price,
            floor_price=item.floor_price
        )
        db.add(pb_item)
    
    db.commit()
    db.refresh(new_pb)

    # Attach product info for response
    response_items = []
    db_items = db.query(PriceBookItemEntity).filter(PriceBookItemEntity.price_book_id == new_pb.id).all()
    for pb_item in db_items:
        prod = db.query(ProductEntity).filter(ProductEntity.id == pb_item.product_id).first()
        response_items.append({
            "id": pb_item.id,
            "product_id": pb_item.product_id,
            "product_code": prod.code if prod else None,
            "product_name": prod.name if prod else None,
            "price": pb_item.price,
            "min_price": pb_item.min_price,
            "sale_price": pb_item.sale_price,
            "floor_price": pb_item.floor_price
        })
    
    return PriceBookResponse(
        id=new_pb.id,
        code=new_pb.code,
        name=new_pb.name,
        customer_group=new_pb.customer_group,
        valid_from=new_pb.valid_from,
        valid_to=new_pb.valid_to,
        status=new_pb.status,
        note=new_pb.note,
        created_by=new_pb.created_by,
        created_at=new_pb.created_at,
        items=response_items
    )

@router.get("", response_model=List[PriceBookResponse])
def get_price_books(
    customer_group: Optional[str] = None,
    status_filter: Optional[str] = None,
    is_active_now: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    query = db.query(PriceBookEntity)
    if customer_group:
        query = query.filter(PriceBookEntity.customer_group == customer_group)
    if status_filter:
        query = query.filter(PriceBookEntity.status == status_filter)
    if is_active_now:
        now = get_utc_now()
        query = query.filter(PriceBookEntity.status == "ACTIVE")
        query = query.filter(PriceBookEntity.valid_from <= now, PriceBookEntity.valid_to >= now)
    
    pbs = query.all()
    # To keep response light, we might not load items for list, but schema expects it. 
    # Let's return without items or empty items for list.
    res = []
    for pb in pbs:
        res.append(PriceBookResponse(
            id=pb.id,
            code=pb.code,
            name=pb.name,
            customer_group=pb.customer_group,
            valid_from=pb.valid_from,
            valid_to=pb.valid_to,
            status=pb.status,
            note=pb.note,
            created_by=pb.created_by,
            created_at=pb.created_at,
            items=[]
        ))
    return res

@router.get("/{id}", response_model=PriceBookResponse)
def get_price_book(
    id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    pb = db.query(PriceBookEntity).filter(PriceBookEntity.id == id).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Không tìm thấy bảng giá.")
    
    response_items = []
    db_items = db.query(PriceBookItemEntity).filter(PriceBookItemEntity.price_book_id == pb.id).all()
    for pb_item in db_items:
        prod = db.query(ProductEntity).filter(ProductEntity.id == pb_item.product_id).first()
        response_items.append({
            "id": pb_item.id,
            "product_id": pb_item.product_id,
            "product_code": prod.code if prod else None,
            "product_name": prod.name if prod else None,
            "price": pb_item.price,
            "min_price": pb_item.min_price,
            "sale_price": pb_item.sale_price,
            "floor_price": pb_item.floor_price
        })
    
    return PriceBookResponse(
        id=pb.id,
        code=pb.code,
        name=pb.name,
        customer_group=pb.customer_group,
        valid_from=pb.valid_from,
        valid_to=pb.valid_to,
        status=pb.status,
        note=pb.note,
        created_by=pb.created_by,
        created_at=pb.created_at,
        items=response_items
    )

@router.put("/{id}", response_model=PriceBookResponse)
def update_price_book(
    id: int,
    data: PriceBookUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_permission([Role.SYSTEM_ADMIN, Role.SALES_MANAGER, Role.ACCOUNTANT]))
):
    pb = db.query(PriceBookEntity).filter(PriceBookEntity.id == id).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Không tìm thấy bảng giá.")
    
    # Check if locked or has orders - REMOVED due to new requirements allowing direct edits

    if data.name is not None:
        pb.name = data.name
    if data.valid_from is not None:
        pb.valid_from = data.valid_from
    if data.valid_to is not None:
        pb.valid_to = data.valid_to
    if data.status is not None:
        pb.status = data.status
    if data.note is not None:
        pb.note = data.note
    
    if data.items is not None:
        # Delete old items and insert new ones
        db.query(PriceBookItemEntity).filter(PriceBookItemEntity.price_book_id == id).delete()
        for item in data.items:
            pb_item = PriceBookItemEntity(
                price_book_id=pb.id,
                product_id=item.product_id,
                price=item.price,
                min_price=item.min_price,
                sale_price=item.sale_price,
                floor_price=item.floor_price
            )
            db.add(pb_item)
            
    db.commit()
    db.refresh(pb)
    return get_price_book(id, db, current_user)




@router.get("/active-price-for-dealer/{dealer_id}")
def get_active_price_for_dealer(
    dealer_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    dealer = db.query(DealerEntity).filter(DealerEntity.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Không tìm thấy đại lý.")
    
    # Lấy customer_group thông qua raw SQL nếu entity chưa có cột này
    from sqlalchemy import text
    try:
        res = db.execute(text("SELECT customer_group FROM dealers WHERE id = :id"), {"id": dealer_id}).fetchone()
        customer_group = res[0] if res and res[0] else "CAP_1"
    except Exception:
        customer_group = "CAP_1"

    now = get_utc_now()
    pb = db.query(PriceBookEntity).filter(
        PriceBookEntity.customer_group == customer_group,
        PriceBookEntity.status == "ACTIVE",
        PriceBookEntity.valid_from <= now,
        PriceBookEntity.valid_to >= now
    ).order_by(PriceBookEntity.created_at.desc()).first()

    if not pb:
        return {
            "dealer_id": dealer.id,
            "dealer_name": dealer.name,
            "customer_group": customer_group,
            "price_book": None,
            "items": []
        }

    response_items = []
    db_items = db.query(PriceBookItemEntity).filter(PriceBookItemEntity.price_book_id == pb.id).all()
    for pb_item in db_items:
        prod = db.query(ProductEntity).filter(ProductEntity.id == pb_item.product_id).first()
        response_items.append({
            "product_id": pb_item.product_id,
            "product_code": prod.code if prod else None,
            "product_name": prod.name if prod else None,
            "price": pb_item.price,
            "min_price": pb_item.min_price,
            "sale_price": pb_item.sale_price,
            "floor_price": pb_item.floor_price
        })

    return {
        "dealer_id": dealer.id,
        "dealer_name": dealer.name,
        "customer_group": customer_group,
        "price_book": {
            "id": pb.id,
            "code": pb.code,
            "name": pb.name,
            "valid_from": pb.valid_from,
            "valid_to": pb.valid_to
        },
        "items": response_items
    }

@router.post("/validate-order-items", response_model=OrderPriceValidationResponse)
def validate_order_items(
    data: OrderPriceValidationRequest,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    dealer = db.query(DealerEntity).filter(DealerEntity.id == data.dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Không tìm thấy đại lý.")
        
    from sqlalchemy import text
    try:
        res = db.execute(text("SELECT customer_group FROM dealers WHERE id = :id"), {"id": data.dealer_id}).fetchone()
        customer_group = res[0] if res and res[0] else "CAP_1"
    except Exception:
        customer_group = "CAP_1"

    now = get_utc_now()
    pb = db.query(PriceBookEntity).filter(
        PriceBookEntity.customer_group == customer_group,
        PriceBookEntity.status == "ACTIVE",
        PriceBookEntity.valid_from <= now,
        PriceBookEntity.valid_to >= now
    ).order_by(PriceBookEntity.created_at.desc()).first()

    if not pb:
        # Nếu không có bảng giá nào, có thể fallback về giá của sản phẩm hoặc yêu cầu duyệt
        raise HTTPException(status_code=400, detail="Không tìm thấy bảng giá đang hiệu lực cho nhóm khách hàng này.")

    items_eval = []
    requires_approval = False
    reasons = []

    # Map product_id to price_book_item
    db_items = db.query(PriceBookItemEntity).filter(PriceBookItemEntity.price_book_id == pb.id).all()
    pb_item_map = {item.product_id: item for item in db_items}

    for order_item in data.items:
        prod = db.query(ProductEntity).filter(ProductEntity.id == order_item.product_id).first()
        prod_code = prod.code if prod else None
        
        pb_item = pb_item_map.get(order_item.product_id)
        if not pb_item:
            # Sản phẩm không có trong bảng giá
            items_eval.append(OrderItemEvaluation(
                product_id=order_item.product_id,
                product_code=prod_code,
                actual_price=order_item.price,
                book_price=0.0,
                min_price=0.0,
                sale_price=None,
                floor_price=None,
                is_below_min=True
            ))
            requires_approval = True
            reasons.append(f"Sản phẩm {prod_code} không có trong bảng giá.")
        else:
            is_below_floor = pb_item.floor_price is not None and order_item.price < pb_item.floor_price
            if is_below_floor:
                requires_approval = True
                reasons.append(f"Sản phẩm {prod_code} có giá bán {order_item.price:,.0f} thấp hơn giá sàn quy định ({pb_item.floor_price:,.0f}).")
            
            items_eval.append(OrderItemEvaluation(
                product_id=order_item.product_id,
                product_code=prod_code,
                actual_price=order_item.price,
                book_price=pb_item.price,
                min_price=pb_item.min_price,
                sale_price=pb_item.sale_price,
                floor_price=pb_item.floor_price,
                is_below_min=is_below_floor
            ))

    approval_status = "PENDING_APPROVAL" if requires_approval else "NORMAL"
    approval_reason = " ".join(reasons) if requires_approval else None

    return OrderPriceValidationResponse(
        price_book_id=pb.id,
        price_book_code=pb.code,
        requires_approval=requires_approval,
        approval_status=approval_status,
        approval_reason=approval_reason,
        items_evaluation=items_eval
    )
