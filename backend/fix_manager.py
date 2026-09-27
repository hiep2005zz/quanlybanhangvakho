from app.api.v1.endpoints.users import USERS_DB, DEALERS_DB

# 1. Mo khoa cho sales_manager
sm = USERS_DB.get("sales_manager")
if sm:
    sm.status = "ACTIVE"
    sm.is_active = True
    print(f"-> Da mo khoa thanh cong cho: {sm.full_name} (Status: {sm.status})")

# 2. Kiem tra lai trang thai toan bo dai ly
print("\n=== TRANG THAI DAI LY HIEN TAI ===")
for d in DEALERS_DB.values():
    sale_user = next((u for u in USERS_DB.values() if getattr(u, 'id', None) == d.assigned_sale_id), None)
    sale_name = sale_user.full_name if sale_user else "Khong ro"
    sale_status = getattr(sale_user, 'status', 'ACTIVE') if sale_user else "ACTIVE"
    print(f"Ma: {d.code} | Ten: {d.name} | Phu trach: ID {d.assigned_sale_id} - {sale_name} [{sale_status}]")
