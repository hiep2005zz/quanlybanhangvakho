from app.api.v1.endpoints.users import USERS_DB, DEALERS_DB

# 1. Kich hoat sales_manager
sm = USERS_DB.get("sales_manager")
if sm:
    sm.status = "ACTIVE"
    sm.is_active = True

# 2. Thuc hien ban giao tu sales sang sales_manager
target_id = getattr(sm, "id", 2)
transferred = 0
for d in DEALERS_DB.values():
    if d.assigned_sale_id == 3:
        d.assigned_sale_id = target_id
        transferred += 1

print(f"=== KET QUA XU LY ===")
print(f"1. Trang thai sales_manager: {sm.status if sm else 'N/A'}")
print(f"2. So dai ly da ban giao sang ID {target_id}: {transferred}")

# 3. Kiem tra tinh trang tat ca dai ly sau khi ban giao
print("\n=== DANH SACH DAI LY CAP NHAT ===")
for d in DEALERS_DB.values():
    sale_user = next((u for u in USERS_DB.values() if getattr(u, 'id', None) == d.assigned_sale_id), None)
    sale_name = sale_user.full_name if sale_user else "Khong ro"
    sale_status = getattr(sale_user, 'status', 'ACTIVE') if sale_user else "ACTIVE"
    print(f"Ma: {d.code} | Ten: {d.name} | Phu trach: ID {d.assigned_sale_id} - {sale_name} [{sale_status}]")
