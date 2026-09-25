# backend/tests/rbac/test_rbac.py
"""
Bộ kiểm thử tự động (Automated Test Suite) cho Hệ thống Phân quyền (RBAC)
Kiểm tra nghiệm thu toàn diện theo các tiêu chí AC 1 -> AC 5.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.rbac import Role, Permission, ROLE_PERMISSIONS, has_permission

client = TestClient(app)


def get_token_for_user(username: str, password: str = "123") -> str:
    """Helper đăng nhập để lấy JWT access token."""
    resp = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Đăng nhập thất bại cho user {username}: {resp.text}"
    return resp.json()["access_token"]


# ==============================================================================
# AC 1: Khai báo vai trò & Ma trận quyền cho 8 vai trò nghiệp vụ
# ==============================================================================
def test_ac1_roles_declared():
    """Kiểm tra hệ thống khai báo đầy đủ vai trò nghiệp vụ và khách hàng."""
    expected_roles = {
        "admin",              # Quản trị hệ thống
        "sales_manager",      # Quản lý kinh doanh
        "sales",              # Nhân viên kinh doanh
        "warehouse",          # Thủ kho
        "warehouse_manager",  # Quản lý kho
        "accountant",         # Kế toán
        "purchasing",         # Nhân viên mua hàng
        "customer",           # Khách hàng, default deny
    }
    system_roles = {r.value for r in Role}
    assert expected_roles.issubset(system_roles), f"Thiếu vai trò trong hệ thống: {expected_roles - system_roles}"

    # Gọi API công khai /api/v1/auth/roles-matrix
    resp = client.get("/api/v1/auth/roles-matrix")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_roles"] == 8
    roles_in_resp = {item["role"] for item in data["roles"]}
    assert expected_roles.issubset(roles_in_resp)


# ==============================================================================
# AC 2: Nguyên tắc Zero-Trust / Default Deny ở Backend
# ==============================================================================
def test_ac2_default_deny_without_token():
    """
    AC 2: Endpoint bắt buộc kiểm tra xác thực.
    Không có token -> Trả về 401 Unauthorized ngay lập tức.
    """
    resp_products = client.get("/api/v1/products")
    assert resp_products.status_code == 401

    resp_inventory = client.post("/api/v1/inventory/adjust", json={"product_id": 1, "adjustment": 5, "reason": "Test"})
    assert resp_inventory.status_code == 401


def test_ac2_default_deny_invalid_token():
    """AC 2: Token giả mạo hoặc sai định dạng -> 401 Unauthorized."""
    headers = {"Authorization": "Bearer invalid.fake.token"}
    resp = client.get("/api/v1/products", headers=headers)
    assert resp.status_code == 401


# ==============================================================================
# AC 4 & AC 5 (Vai trò 1): Nhân viên kinh doanh (Sales) BỊ CHẶN can thiệp Kho
# ==============================================================================
def test_ac4_sales_forbidden_to_write_inventory_adjust():
    """
    AC 4 & AC 5 (Vai trò 1):
    Nhân viên kinh doanh cố tình gọi API điều chỉnh tồn kho (POST /api/v1/inventory/adjust)
    -> Backend từ chối ngay lập tức với HTTP 403 Forbidden.
    """
    token = get_token_for_user("sales")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "product_id": 1,
        "adjustment": 10,
        "reason": "Nhân viên kinh doanh tự ý sửa tồn kho",
    }
    resp = client.post("/api/v1/inventory/adjust", json=payload, headers=headers)
    assert resp.status_code == 403
    error_detail = resp.json().get("detail", "")
    assert "inventory:write" in error_detail or "403 Forbidden" in error_detail


def test_ac4_sales_forbidden_to_create_receipt_and_issue():
    """
    AC 4: Chặn quyền POST nhập/xuất kho đối với Nhân viên kinh doanh.
    -> Expect 403 Forbidden.
    """
    token = get_token_for_user("sales")
    headers = {"Authorization": f"Bearer {token}"}

    # Thử lập phiếu nhập kho
    receipt_payload = {"product_id": 1, "quantity": 20, "supplier": "NCC X", "note": "Sales lập"}
    resp_receipt = client.post("/api/v1/inventory/receipt", json=receipt_payload, headers=headers)
    assert resp_receipt.status_code == 403

    # Thử lập phiếu xuất kho
    issue_payload = {"product_id": 1, "quantity": 5, "destination": "Khách Y", "note": "Sales lập"}
    resp_issue = client.post("/api/v1/inventory/issue", json=issue_payload, headers=headers)
    assert resp_issue.status_code == 403


def test_ac4_sales_forbidden_to_put_and_delete_stock():
    """
    AC 4: Chặn các thao tác ghi khác (PUT / DELETE) trên kho đối với Nhân viên kinh doanh.
    -> Expect 403 Forbidden.
    """
    token = get_token_for_user("sales")
    headers = {"Authorization": f"Bearer {token}"}

    # Thử PUT cập nhật tồn kho qua API inventory
    resp_put = client.put("/api/v1/inventory/1/stock", json={"new_stock": 999, "reason": "Hacking stock"}, headers=headers)
    assert resp_put.status_code == 403

    # Thử PUT cập nhật tồn kho trực tiếp qua API products
    resp_prod_put = client.put("/api/v1/products/1/stock", json={"stock": 999}, headers=headers)
    assert resp_prod_put.status_code == 403

    resp_prod_direct = client.put("/api/v1/products/1", json={"stock": 999}, headers=headers)
    assert resp_prod_direct.status_code == 403

    # Thử DELETE reset tồn kho
    resp_del = client.delete("/api/v1/inventory/1/stock", headers=headers)
    assert resp_del.status_code == 403


# ==============================================================================
# AC 3 & AC 5 (Vai trò 2): Thủ kho (Warehouse) KHÔNG xem được Giá vốn & Biên lợi nhuận
# ==============================================================================
def test_ac3_warehouse_staff_cost_data_isolated_and_stripped():
    """
    AC 3 & AC 5 (Vai trò 2):
    Thủ kho gọi API danh sách sản phẩm (GET /api/v1/products):
    - Server gỡ bỏ hoàn toàn 'cost_price', 'profit_margin', 'profit_per_unit' (None).
    - 'is_cost_price_visible' trả về False.
    - Dữ liệu tổng kết tài chính cũng che giấu 'total_cost_value' và 'total_gross_profit'.
    """
    token = get_token_for_user("kho")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/products", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["is_cost_price_visible"] is False
    assert len(data["items"]) > 0

    for item in data["items"]:
        # TUYỆT ĐỐI không chứa giá vốn hay biên lợi nhuận
        assert item["cost_price"] is None, f"LỖI BẢO MẬT: Thủ kho xem được cost_price ở sản phẩm {item['code']}"
        assert item["profit_margin"] is None, f"LỖI BẢO MẬT: Thủ kho xem được profit_margin ở sản phẩm {item['code']}"
        assert item["profit_per_unit"] is None, f"LỖI BẢO MẬT: Thủ kho xem được profit_per_unit ở sản phẩm {item['code']}"
        # Nhưng thông tin tên, mã, số lượng tồn kho vẫn đầy đủ để phục vụ nghiệp vụ kho
        assert item["stock"] >= 0
        assert item["name"] != ""

    summary = data.get("summary")
    if summary:
        assert summary["total_cost_value"] is None
        assert summary["total_gross_profit"] is None
        assert summary["average_margin_percent"] is None


def test_warehouse_staff_can_write_inventory():
    """Thủ kho được phép thực hiện các thao tác ghi kho (nhập/xuất/điều chỉnh)."""
    token = get_token_for_user("kho")
    headers = {"Authorization": f"Bearer {token}"}

    # Thủ kho điều chỉnh kho -> Thành công 200 OK
    payload = {"product_id": 1, "adjustment": 5, "reason": "Kiểm kê định kỳ phát hiện thừa 5 cái"}
    resp = client.post("/api/v1/inventory/adjust", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"


# ==============================================================================
# AC 3 & AC 5 (Vai trò 3): Quản lý kinh doanh (Sales Manager) ĐƯỢC XEM Giá vốn & Lợi nhuận
# ==============================================================================
def test_ac3_sales_manager_can_view_cost_and_profit():
    """
    AC 3 & AC 5 (Vai trò 3):
    Quản lý kinh doanh gọi API sản phẩm (GET /api/v1/products):
    - Payload API trả về ĐẦY ĐỦ 'cost_price', 'profit_margin', 'profit_per_unit'.
    - 'is_cost_price_visible' trả về True.
    - Dữ liệu tổng kết tài chính trả về đầy đủ 'total_cost_value' và 'total_gross_profit'.
    """
    token = get_token_for_user("sales_manager")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/products", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["is_cost_price_visible"] is True
    assert len(data["items"]) > 0

    for item in data["items"]:
        assert item["cost_price"] is not None and item["cost_price"] > 0
        assert item["profit_margin"] is not None
        assert item["profit_per_unit"] is not None
        # Kiểm tra tính toán biên lợi nhuận chuẩn
        expected_profit = item["sell_price"] - item["cost_price"]
        assert round(item["profit_per_unit"], 2) == round(expected_profit, 2)

    summary = data.get("summary")
    assert summary is not None
    assert summary["total_cost_value"] is not None and summary["total_cost_value"] > 0
    assert summary["total_gross_profit"] is not None


def test_sales_manager_cannot_write_inventory():
    """
    Quản lý kinh doanh xem được giá vốn và doanh số,
    nhưng KHÔNG có quyền can thiệp ghi kho (inventory:write) -> 403 Forbidden.
    """
    token = get_token_for_user("sales_manager")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"product_id": 1, "adjustment": 20, "reason": "Sales manager tự ý sửa kho"}
    resp = client.post("/api/v1/inventory/adjust", json=payload, headers=headers)
    assert resp.status_code == 403


# ==============================================================================
# Quản trị hệ thống (System Admin): Toàn quyền
# ==============================================================================
def test_admin_has_full_permissions():
    """Quản trị hệ thống có đầy đủ quyền xem giá vốn và quyền ghi kho."""
    token = get_token_for_user("admin")
    headers = {"Authorization": f"Bearer {token}"}

    # Xem giá vốn
    resp_prod = client.get("/api/v1/products", headers=headers)
    assert resp_prod.status_code == 200
    assert resp_prod.json()["is_cost_price_visible"] is True
    assert resp_prod.json()["items"][0]["cost_price"] is not None

    # Thao tác kho
    resp_adj = client.post("/api/v1/inventory/adjust", json={"product_id": 1, "adjustment": 2, "reason": "Admin cân đối kho"}, headers=headers)
    assert resp_adj.status_code == 200


# ==============================================================================
# Kiểm tra bổ sung các vai trò còn lại trong 7 vai trò: Bảo vệ giá vốn & kho
# ==============================================================================
@pytest.mark.parametrize("uname", ["ketoan", "muahang", "warehouse_mgr"])
def test_other_roles_cannot_view_cost(uname: str):
    """
    AC 3: Kế toán, Nhân viên mua hàng, Quản lý kho:
    Giá vốn & biên lợi nhuận tuyệt đối BỊ GỠ BỎ (None) khỏi response.
    Chỉ lộ ra với vai trò Quản lý kinh doanh (hoặc Quản trị hệ thống).
    """
    token = get_token_for_user(uname)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/products", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["is_cost_price_visible"] is False
    for item in data["items"]:
        assert item["cost_price"] is None
        assert item["profit_margin"] is None


@pytest.mark.parametrize("uname", ["ketoan", "muahang"])
def test_non_warehouse_roles_cannot_write_inventory(uname: str):
    """
    Kế toán và Mua hàng không có quyền can thiệp ghi kho -> 403 Forbidden.
    """
    token = get_token_for_user(uname)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/inventory/adjust", json={"product_id": 1, "adjustment": 1, "reason": "test"}, headers=headers)
    assert resp.status_code == 403
