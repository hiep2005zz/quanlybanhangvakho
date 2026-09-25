# backend/app/core/rbac.py
"""
Hệ thống Phân quyền theo Vai trò (Role-Based Access Control - RBAC)
Nguyên tắc: Zero-Trust & Default Deny
"""
from enum import Enum
from typing import Dict, Set, List


class Role(str, Enum):
    SYSTEM_ADMIN = "admin"                    # Quản trị hệ thống
    SALES_MANAGER = "sales_manager"          # Quản lý kinh doanh
    SALES = "sales"                          # Nhân viên kinh doanh
    WAREHOUSE_STAFF = "warehouse"            # Thủ kho
    WAREHOUSE_MANAGER = "warehouse_manager"  # Quản lý kho
    ACCOUNTANT = "accountant"                # Kế toán
    PURCHASING_STAFF = "purchasing"          # Nhân viên mua hàng


class Permission(str, Enum):
    # Tài nguyên: Sản phẩm
    PRODUCT_READ = "product:read"
    PRODUCT_WRITE = "product:write"

    # Dữ liệu nhạy cảm: Giá vốn & Lợi nhuận (Chỉ Quản lý kinh doanh & Admin)
    COST_READ = "cost:read"

    # Tài nguyên: Kho & Tồn kho
    INVENTORY_READ = "inventory:read"
    INVENTORY_WRITE = "inventory:write"      # Nhập/xuất/điều chỉnh kho (Sales bị chặn hoàn toàn!)

    # Tài nguyên: Đơn hàng bán
    ORDER_READ = "order:read"
    ORDER_WRITE = "order:write"

    # Tài nguyên: Báo cáo
    REPORT_READ = "report:read"

    # Tài nguyên: Mua hàng
    PURCHASE_READ = "purchase:read"
    PURCHASE_WRITE = "purchase:write"

    # Tài nguyên: Quản trị hệ thống & Phân quyền
    USER_MANAGE = "user:manage"


# Ma trận phân quyền cho 7 vai trò nghiệp vụ (RBAC Matrix)
ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    # 1. Quản trị hệ thống: Toàn quyền hệ thống
    Role.SYSTEM_ADMIN.value: {
        "*"  # Wildcard superuser
    },

    # 2. Quản lý kinh doanh: Xem/sửa sản phẩm, xem đơn hàng, xem báo cáo VÀ ĐƯỢC XEM GIÁ VỐN / LỢI NHUẬN
    # Tuyệt đối KHÔNG có quyền can thiệp ghi kho (inventory:write)
    Role.SALES_MANAGER.value: {
        Permission.PRODUCT_READ.value,
        Permission.PRODUCT_WRITE.value,
        Permission.COST_READ.value,          # Được xem giá vốn & biên lợi nhuận
        Permission.INVENTORY_READ.value,     # Chỉ xem tồn kho để điều phối
        Permission.ORDER_READ.value,
        Permission.ORDER_WRITE.value,
        Permission.REPORT_READ.value,
    },

    # 3. Nhân viên kinh doanh: Xem SP, tạo đơn hàng, xem tồn kho bán.
    # KHÔNG được xem giá vốn (cost:read) và TUYỆT ĐỐI CHẶN can thiệp kho (inventory:write)
    Role.SALES.value: {
        Permission.PRODUCT_READ.value,
        Permission.ORDER_READ.value,
        Permission.ORDER_WRITE.value,
        Permission.INVENTORY_READ.value,     # Xem số lượng tồn để bán hàng
    },

    # 4. Thủ kho: Thao tác kho toàn diện (nhập, xuất, kiểm kê, điều chỉnh).
    # TUYỆT ĐỐI KHÔNG ĐƯỢC XEM GIÁ VỐN VÀ BIÊN LỢI NHUẬN (cost:read)
    Role.WAREHOUSE_STAFF.value: {
        Permission.PRODUCT_READ.value,
        Permission.INVENTORY_READ.value,
        Permission.INVENTORY_WRITE.value,    # Có quyền ghi kho
    },

    # 5. Quản lý kho: Quản lý kho hàng & xem phiếu mua hàng.
    # Không có quyền xem giá vốn / biên lợi nhuận
    Role.WAREHOUSE_MANAGER.value: {
        Permission.PRODUCT_READ.value,
        Permission.INVENTORY_READ.value,
        Permission.INVENTORY_WRITE.value,
        Permission.PURCHASE_READ.value,
        Permission.REPORT_READ.value,
    },

    # 6. Kế toán: Xem chứng từ, đơn hàng, mua hàng, báo cáo chung.
    # Không có quyền can thiệp kho (inventory:write)
    Role.ACCOUNTANT.value: {
        Permission.PRODUCT_READ.value,
        Permission.ORDER_READ.value,
        Permission.PURCHASE_READ.value,
        Permission.REPORT_READ.value,
        Permission.INVENTORY_READ.value,
    },

    # 7. Nhân viên mua hàng: Tạo và theo dõi phiếu mua hàng, xem tồn kho.
    # Không can thiệp kho trực tiếp
    Role.PURCHASING_STAFF.value: {
        Permission.PRODUCT_READ.value,
        Permission.PURCHASE_READ.value,
        Permission.PURCHASE_WRITE.value,
        Permission.INVENTORY_READ.value,
    },
}

# Thông tin mô tả 7 vai trò nghiệp vụ
ROLE_DETAILS: Dict[str, dict] = {
    Role.SYSTEM_ADMIN.value: {
        "title": "Quản trị hệ thống",
        "badge_color": "#ef4444",
        "description": "Toàn quyền quản trị tài khoản, cấu hình và giám sát dữ liệu.",
        "can_view_cost": True,
        "can_write_inventory": True,
    },
    Role.SALES_MANAGER.value: {
        "title": "Quản lý kinh doanh",
        "badge_color": "#8b5cf6",
        "description": "Quản lý bán hàng, xem báo cáo doanh thu, giá vốn và biên lợi nhuận. Không can thiệp kho.",
        "can_view_cost": True,
        "can_write_inventory": False,
    },
    Role.SALES.value: {
        "title": "Nhân viên kinh doanh",
        "badge_color": "#3b82f6",
        "description": "Tạo đơn hàng, tra cứu tồn kho bán hàng. Bị chặn xem giá vốn và bị chặn can thiệp kho.",
        "can_view_cost": False,
        "can_write_inventory": False,
    },
    Role.WAREHOUSE_STAFF.value: {
        "title": "Thủ kho",
        "badge_color": "#10b981",
        "description": "Thực hiện nhập, xuất, kiểm kê kho. Tuyệt đối không xem giá vốn và lợi nhuận.",
        "can_view_cost": False,
        "can_write_inventory": True,
    },
    Role.WAREHOUSE_MANAGER.value: {
        "title": "Quản lý kho",
        "badge_color": "#059669",
        "description": "Giám sát quy trình kho vận, theo dõi đơn mua hàng. Không xem giá vốn tài chính.",
        "can_view_cost": False,
        "can_write_inventory": True,
    },
    Role.ACCOUNTANT.value: {
        "title": "Kế toán",
        "badge_color": "#f59e0b",
        "description": "Đối soát sổ sách hóa đơn, chứng từ đơn hàng và mua hàng.",
        "can_view_cost": False,
        "can_write_inventory": False,
    },
    Role.PURCHASING_STAFF.value: {
        "title": "Nhân viên mua hàng",
        "badge_color": "#06b6d4",
        "description": "Lập phiếu mua hàng, theo dõi đơn nhập từ nhà cung cấp. Không can thiệp kho trực tiếp.",
        "can_view_cost": False,
        "can_write_inventory": False,
    },
}


def get_role_permissions(role: str) -> List[str]:
    """Lấy danh sách các quyền hạn được cấp cho vai trò (nếu admin trả về all)."""
    if not role or role not in ROLE_PERMISSIONS:
        return []
    
    perms = ROLE_PERMISSIONS[role]
    if "*" in perms:
        return [p.value for p in Permission]
    return sorted(list(perms))


def has_permission(role: str, permission: str) -> bool:
    """
    Kiểm tra xem vai trò có quyền thực thi thao tác hay không.
    Nguyên tắc Default Deny:
    - Nếu vai trò không tồn tại trong hệ thống -> False
    - Nếu vai trò chưa được cấp quyền tương ứng -> False
    """
    if not role:
        return False
    perms = ROLE_PERMISSIONS.get(role)
    if perms is None:
        return False
    if "*" in perms:
        return True
    return permission in perms
