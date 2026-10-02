# backend/tests/test_audit_logs.py
"""
Test Suite cho User Story SCRUM-29:
Ghi và xem nhật ký thao tác trên tồn kho, giá, hạn mức công nợ và hoá đơn.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_token(username: str, password: str = "123") -> str:
    resp = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return resp.json()["access_token"]


def test_audit_logs_requires_admin():
    """Chỉ có role Quản trị hệ thống (Admin) mới có quyền truy cập /api/v1/audit-logs."""
    sales_token = get_token("sales")
    kho_token = get_token("kho")
    admin_token = get_token("admin")

    # Sales bị 403 Forbidden
    res_sales = client.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {sales_token}"})
    assert res_sales.status_code == 403

    # Kho bị 403 Forbidden
    res_kho = client.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {kho_token}"})
    assert res_kho.status_code == 403

    # Admin vào thành công 200 OK
    res_admin = client.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert "items" in data
    assert "total" in data


def test_inventory_adjust_creates_audit_log():
    """Khi thao tác điều chỉnh kho, hệ thống tự động ghi nhật ký vào audit_logs."""
    admin_token = get_token("admin")
    kho_token = get_token("kho")

    # Thủ kho thực hiện kiểm kê / điều chỉnh tồn kho
    adjust_resp = client.post(
        "/api/v1/inventory/adjust",
        headers={"Authorization": f"Bearer {kho_token}"},
        json={"product_id": 1, "adjustment": 5, "reason": "Kiểm kê định kỳ phát hiện dư"}
    )
    assert adjust_resp.status_code == 200

    # Admin tra cứu audit-logs
    logs_resp = client.get(
        "/api/v1/audit-logs?entity_type=Product&action_type=INVENTORY_ADJUST",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert logs_resp.status_code == 200
    logs = logs_resp.json()["items"]
    assert len(logs) > 0
    latest = logs[0]
    assert latest["action_type"] == "INVENTORY_ADJUST"
    assert latest["entity_type"] == "Product"
    assert latest["entity_id"] == "SP001"
    assert "Kiểm kê định kỳ phát hiện dư" in latest["reason"]


def test_price_change_creates_audit_log():
    """Khi cập nhật giá bán hoặc giá vốn, hệ thống tự động ghi nhật ký PRICE_CHANGE."""
    admin_token = get_token("admin")

    price_resp = client.put(
        "/api/v1/products/2/price",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"sell_price": 395000.0, "cost_price": 165000.0, "reason": "Tăng giá theo bảng giá quý 4"}
    )
    assert price_resp.status_code == 200

    # Tra cứu lịch sử riêng của sản phẩm SP002
    entity_resp = client.get(
        "/api/v1/audit-logs/entity/Product/SP002",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert entity_resp.status_code == 200
    items = entity_resp.json()
    assert len(items) > 0
    assert items[0]["action_type"] == "PRICE_CHANGE"
    assert "Tăng giá theo bảng giá quý 4" in items[0]["reason"]


def test_debt_limit_change_creates_audit_log():
    """Khi thay đổi hạn mức công nợ khách hàng, hệ thống ghi DEBT_LIMIT_CHANGE."""
    admin_token = get_token("admin")

    debt_resp = client.put(
        "/api/v1/orders/dealers/1/debt-limit",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"credit_limit": 100000000.0, "reason": "Nâng hạn mức tín dụng khách hàng VIP"}
    )
    assert debt_resp.status_code == 200

    # Tra cứu lịch sử riêng của CustomerDebt DL001
    entity_resp = client.get(
        "/api/v1/audit-logs/entity/CustomerDebt/DL001",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert entity_resp.status_code == 200
    items = entity_resp.json()
    assert len(items) > 0
    assert items[0]["action_type"] == "DEBT_LIMIT_CHANGE"
    assert items[0]["entity_id"] == "DL001"


def test_invoice_edit_creates_audit_log():
    """Khi sửa đổi hoặc hủy hóa đơn, hệ thống ghi INVOICE_EDIT."""
    admin_token = get_token("admin")

    create_resp = client.post(
        "/api/v1/orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "dealer_id": 1,
            "items": [{"product_id": 1, "quantity": 1, "price": 199000, "unit": "Cái"}],
        },
    )
    assert create_resp.status_code == 201
    order_code = create_resp.json()["order_code"]

    edit_resp = client.put(
        f"/api/v1/orders/{order_code}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "CANCELLED", "note": "Hủy theo yêu cầu khách hàng", "reason": "Khách hủy hợp đồng"}
    )
    assert edit_resp.status_code == 200

    entity_resp = client.get(
        f"/api/v1/audit-logs/entity/Invoice/{order_code}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert entity_resp.status_code == 200
    items = entity_resp.json()
    assert len(items) > 0
    assert items[0]["action_type"] == "INVOICE_EDIT"
    assert items[0]["entity_id"] == order_code
