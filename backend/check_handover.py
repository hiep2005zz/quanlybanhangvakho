from app.api.v1.endpoints.users import USERS_DB, DEALERS_DB

print("=== TRUOC KHI BAN GIAO ===")
for d in DEALERS_DB.values():
    sale_user = next((u for u in USERS_DB.values() if getattr(u, 'id', None) == d.assigned_sale_id), None)
    sale_name = sale_user.full_name if sale_user else "Khong ro"
    sale_status = getattr(sale_user, 'status', 'ACTIVE') if sale_user else "ACTIVE"
    print(f"Ma: {d.code} | Ten: {d.name} | ID Phu trach: {d.assigned_sale_id} ({sale_name} - {sale_status})")

# Chuyen giao sang sales_manager (ID: 2)
target_user = USERS_DB.get("sales_manager")
new_sale_id = getattr(target_user, "id", 2)

transferred = 0
for d in DEALERS_DB.values():
    if d.assigned_sale_id == 3:
        d.assigned_sale_id = new_sale_id
        transferred += 1

print(f"\n-> Da ban giao thanh cong {transferred} dai ly sang sales_manager (ID: {new_sale_id})")

print("\n=== SAU KHI BAN GIAO ===")
for d in DEALERS_DB.values():
    sale_user = next((u for u in USERS_DB.values() if getattr(u, 'id', None) == d.assigned_sale_id), None)
    sale_name = sale_user.full_name if sale_user else "Khong ro"
    sale_status = getattr(sale_user, 'status', 'ACTIVE') if sale_user else "ACTIVE"
    print(f"Ma: {d.code} | Ten: {d.name} | ID Phu trach: {d.assigned_sale_id} ({sale_name} - {sale_status})")
