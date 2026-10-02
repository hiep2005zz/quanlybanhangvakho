# backend/app/api/v1/endpoints/discounts.py
"""
API Endpoints cho Chính sách chiết khấu theo sản lượng (Volume Discount Policy).
Quyền hạn:
- Quản lý kinh doanh (sales_manager) & Admin: Khai báo, chỉnh sửa, bật/tắt, xóa chính sách.
- Nhân viên bán hàng (sales) & Kế toán (accountant): Tra cứu và tính toán chiết khấu tự động.
"""
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, require_permission
from app.core.rbac import Permission, Role
from app.schemas.auth import UserResponse
from app.models.discount import (
    DISCOUNTS_DB,
    DiscountPolicy,
    DiscountTier,
    get_next_discount_id,
    save_discounts_db,
    load_discounts_db,
)
from app.schemas.discount import (
    DiscountPolicyCreate,
    DiscountPolicyUpdate,
    DiscountPolicyResponse,
    DiscountListResponse,
    DiscountTierSchema,
    DiscountCalculateRequest,
    DiscountCalculateResponse,
)
from app.api.v1.endpoints.products import RAW_PRODUCTS

router = APIRouter()

def user_can_manage_discounts(current_user: UserResponse) -> bool:
    """Kiểm tra người dùng có quyền Quản lý kinh doanh hoặc Admin hay không."""
    user_roles = getattr(current_user, "roles", []) or [current_user.role]
    if any(r in [Role.SYSTEM_ADMIN.value, Role.SALES_MANAGER.value] for r in user_roles):
        return True
    return Permission.DISCOUNT_MANAGE.value in current_user.permissions or "*" in current_user.permissions

@router.get("", response_model=DiscountListResponse)
def get_all_discount_policies(
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: UserResponse = Depends(require_permission(Permission.DISCOUNT_READ.value))
):
    """
    Lấy danh sách các chính sách chiết khấu theo sản lượng.
    Hỗ trợ lọc theo ngành hàng hoặc trạng thái hiệu lực.
    """
    load_discounts_db()
    items = list(DISCOUNTS_DB.values())

    if category and category != "ALL":
        items = [p for p in items if p.category in [category, "ALL"]]

    if is_active is not None:
        items = [p for p in items if p.is_active == is_active]

    # Sắp xếp chính sách mới nhất lên đầu
    items.sort(key=lambda x: x.id, reverse=True)

    can_manage = user_can_manage_discounts(current_user)

    responses = [
        DiscountPolicyResponse(
            id=p.id,
            code=p.code,
            name=p.name,
            category=p.category,
            target_dealer_type=p.target_dealer_type,
            description=p.description,
            is_active=p.is_active,
            tiers=[DiscountTierSchema(**t.model_dump()) for t in p.tiers],
            created_by=p.created_by,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in items
    ]

    return DiscountListResponse(
        items=responses,
        total=len(responses),
        can_manage=can_manage
    )

@router.post("", response_model=DiscountPolicyResponse, status_code=status.HTTP_201_CREATED)
def create_discount_policy(
    payload: DiscountPolicyCreate,
    current_user: UserResponse = Depends(require_permission(Permission.DISCOUNT_MANAGE.value))
):
    """
    Khai báo chính sách chiết khấu theo sản lượng mới.
    Chỉ Quản lý kinh doanh (sales_manager) hoặc Admin mới được phép thao tác.
    """
    load_discounts_db()
    new_id = get_next_discount_id()

    # Tự sinh mã nếu người dùng không nhập
    code = payload.code.strip() if payload.code else f"CK-SL{new_id:02d}"

    # Kiểm tra trùng mã
    for p in DISCOUNTS_DB.values():
        if p.code.lower() == code.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mã chính sách chiết khấu '{code}' đã tồn tại trên hệ thống."
            )

    # Sắp xếp các nấc chiết khấu theo min_quantity tăng dần
    sorted_tiers_input = sorted(payload.tiers, key=lambda t: t.min_quantity)
    tiers = [
        DiscountTier(
            id=idx + 1,
            min_quantity=t.min_quantity,
            max_quantity=t.max_quantity,
            discount_percent=t.discount_percent,
        )
        for idx, t in enumerate(sorted_tiers_input)
    ]

    now_iso = datetime.now(timezone.utc).isoformat()
    creator_name = current_user.full_name or current_user.username
    creator_display = f"{creator_name} ({current_user.role})"

    new_policy = DiscountPolicy(
        id=new_id,
        code=code,
        name=payload.name.strip(),
        category=payload.category,
        target_dealer_type=payload.target_dealer_type,
        description=payload.description.strip() if payload.description else None,
        is_active=payload.is_active,
        tiers=tiers,
        created_by=creator_display,
        created_at=now_iso,
        updated_at=now_iso,
    )

    DISCOUNTS_DB[new_id] = new_policy
    save_discounts_db()

    return DiscountPolicyResponse(
        id=new_policy.id,
        code=new_policy.code,
        name=new_policy.name,
        category=new_policy.category,
        target_dealer_type=new_policy.target_dealer_type,
        description=new_policy.description,
        is_active=new_policy.is_active,
        tiers=[DiscountTierSchema(**t.model_dump()) for t in new_policy.tiers],
        created_by=new_policy.created_by,
        created_at=new_policy.created_at,
        updated_at=new_policy.updated_at,
    )

@router.put("/{policy_id}", response_model=DiscountPolicyResponse)
def update_discount_policy(
    policy_id: int,
    payload: DiscountPolicyUpdate,
    current_user: UserResponse = Depends(require_permission(Permission.DISCOUNT_MANAGE.value))
):
    """
    Cập nhật chính sách chiết khấu theo sản lượng.
    """
    load_discounts_db()
    policy = DISCOUNTS_DB.get(policy_id)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy chính sách chiết khấu có ID {policy_id}."
        )

    if payload.name is not None:
        policy.name = payload.name.strip()
    if payload.category is not None:
        policy.category = payload.category
    if payload.target_dealer_type is not None:
        policy.target_dealer_type = payload.target_dealer_type
    if payload.description is not None:
        policy.description = payload.description.strip() if payload.description else None
    if payload.is_active is not None:
        policy.is_active = payload.is_active

    if payload.tiers is not None:
        sorted_tiers_input = sorted(payload.tiers, key=lambda t: t.min_quantity)
        policy.tiers = [
            DiscountTier(
                id=idx + 1,
                min_quantity=t.min_quantity,
                max_quantity=t.max_quantity,
                discount_percent=t.discount_percent,
            )
            for idx, t in enumerate(sorted_tiers_input)
        ]

    policy.updated_at = datetime.now(timezone.utc).isoformat()
    save_discounts_db()

    return DiscountPolicyResponse(
        id=policy.id,
        code=policy.code,
        name=policy.name,
        category=policy.category,
        target_dealer_type=policy.target_dealer_type,
        description=policy.description,
        is_active=policy.is_active,
        tiers=[DiscountTierSchema(**t.model_dump()) for t in policy.tiers],
        created_by=policy.created_by,
        created_at=policy.created_at,
        updated_at=policy.updated_at,
    )

@router.patch("/{policy_id}/toggle-status", response_model=DiscountPolicyResponse)
def toggle_discount_status(
    policy_id: int,
    current_user: UserResponse = Depends(require_permission(Permission.DISCOUNT_MANAGE.value))
):
    """Bật hoặc tạm ngưng một chính sách chiết khấu."""
    load_discounts_db()
    policy = DISCOUNTS_DB.get(policy_id)
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy chính sách chiết khấu có ID {policy_id}."
        )

    policy.is_active = not policy.is_active
    policy.updated_at = datetime.now(timezone.utc).isoformat()
    save_discounts_db()

    return DiscountPolicyResponse(
        id=policy.id,
        code=policy.code,
        name=policy.name,
        category=policy.category,
        target_dealer_type=policy.target_dealer_type,
        description=policy.description,
        is_active=policy.is_active,
        tiers=[DiscountTierSchema(**t.model_dump()) for t in policy.tiers],
        created_by=policy.created_by,
        created_at=policy.created_at,
        updated_at=policy.updated_at,
    )

@router.delete("/{policy_id}", status_code=status.HTTP_200_OK)
def delete_discount_policy(
    policy_id: int,
    current_user: UserResponse = Depends(require_permission(Permission.DISCOUNT_MANAGE.value))
):
    """Xóa chính sách chiết khấu."""
    load_discounts_db()
    if policy_id not in DISCOUNTS_DB:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy chính sách chiết khấu có ID {policy_id}."
        )

    del DISCOUNTS_DB[policy_id]
    save_discounts_db()
    return {"status": "success", "message": f"Đã xóa thành công chính sách chiết khấu #{policy_id}."}

@router.post("/calculate", response_model=DiscountCalculateResponse)
def calculate_discount_for_product(
    payload: DiscountCalculateRequest,
    current_user: UserResponse = Depends(require_permission(Permission.DISCOUNT_READ.value))
):
    """
    Tính chiết khấu tự động theo sản lượng:
    - Tìm sản phẩm theo product_id.
    - Tìm chính sách chiết khấu đang áp dụng tốt nhất cho sản phẩm đó theo số lượng đặt hàng.
    - Trả về chi tiết: giá gốc, % chiết khấu, giá sau giảm, tổng tiền tiết kiệm.
    - Nếu là Quản lý kinh doanh (thấy giá vốn): trả về thêm Lợi nhuận gộp và Biên LN để kiểm soát không bị lỗ.
    """
    # 1. Tìm sản phẩm
    product = next((p for p in RAW_PRODUCTS if p["id"] == payload.product_id), None)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sản phẩm có ID {payload.product_id}."
        )

    load_discounts_db()
    qty = payload.quantity
    sell_price = product["sell_price"]
    cost_price = product.get("cost_price", 0.0)
    can_view_cost = current_user.can_view_cost or (Permission.COST_READ.value in current_user.permissions)

    # 2. Tìm chính sách phù hợp nhất (ưu tiên cùng category, sau đó đến category='ALL')
    active_policies = [p for p in DISCOUNTS_DB.values() if p.is_active]
    matched_policy = next((p for p in active_policies if p.category == product["category"]), None)
    if not matched_policy:
        matched_policy = next((p for p in active_policies if p.category == "ALL"), None)

    discount_percent = 0.0
    applied_policy_id = None
    applied_policy_name = None
    applied_tier_label = None

    if matched_policy:
        applied_policy_id = matched_policy.id
        applied_policy_name = matched_policy.name

        # Tìm nấc chiết khấu phù hợp với sản lượng
        for tier in matched_policy.tiers:
            if qty >= tier.min_quantity:
                if tier.max_quantity is None or qty <= tier.max_quantity:
                    discount_percent = tier.discount_percent
                    if tier.max_quantity:
                        applied_tier_label = f"Từ {tier.min_quantity} đến {tier.max_quantity} SP (Chiết khấu {tier.discount_percent}%)"
                    else:
                        applied_tier_label = f"Từ {tier.min_quantity} SP trở lên (Chiết khấu {tier.discount_percent}%)"
                    break

    # 3. Tính toán các con số tài chính
    unit_discount = round(sell_price * (discount_percent / 100.0), 2)
    discounted_unit_price = round(sell_price - unit_discount, 2)
    total_original = round(sell_price * qty, 2)
    total_final = round(discounted_unit_price * qty, 2)
    total_saved = round(total_original - total_final, 2)

    # 4. Bảo mật dữ liệu nhạy cảm Giá vốn & Biên lợi nhuận (chỉ Sales Manager & Admin)
    gross_profit = None
    gross_margin_percent = None
    cost_price_val = None

    if can_view_cost and cost_price > 0:
        cost_price_val = cost_price
        total_cost = round(cost_price * qty, 2)
        gross_profit = round(total_final - total_cost, 2)
        gross_margin_percent = round((gross_profit / total_final) * 100.0, 2) if total_final > 0 else 0.0

    return DiscountCalculateResponse(
        product_id=product["id"],
        product_name=product["name"],
        category=product["category"],
        quantity=qty,
        unit_price=sell_price,
        cost_price=cost_price_val,
        applied_policy_id=applied_policy_id,
        applied_policy_name=applied_policy_name,
        applied_tier_label=applied_tier_label,
        discount_percent=discount_percent,
        unit_discount=unit_discount,
        discounted_unit_price=discounted_unit_price,
        total_original_price=total_original,
        total_discount_amount=total_saved,
        total_final_price=total_final,
        gross_profit=gross_profit,
        gross_margin_percent=gross_margin_percent,
    )
