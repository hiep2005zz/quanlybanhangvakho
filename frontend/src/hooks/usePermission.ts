// frontend/src/hooks/usePermission.ts
import { User } from '../services/api';

export const Permissions = {
  PRODUCT_READ: 'product:read',
  PRODUCT_WRITE: 'product:write',
  COST_READ: 'cost:read',             // Xem giá vốn và biên lợi nhuận
  INVENTORY_READ: 'inventory:read',
  INVENTORY_WRITE: 'inventory:write', // Thao tác ghi kho: Nhập, xuất, điều chỉnh (Sales bị chặn)
  ORDER_READ: 'order:read',
  ORDER_WRITE: 'order:write',
  REPORT_READ: 'report:read',
  PURCHASE_READ: 'purchase:read',
  PURCHASE_WRITE: 'purchase:write',
  USER_MANAGE: 'user:manage',
} as const;

export type PermissionType = typeof Permissions[keyof typeof Permissions];

/**
 * Kiểm tra xem người dùng có quyền cụ thể hay không.
 * Nếu user là admin (hoặc có '*'), luôn trả về true.
 */
export function hasPermission(user: User | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!user.permissions || !Array.isArray(user.permissions)) return false;
  if (user.permissions.includes('*')) return true;
  return user.permissions.includes(permission);
}

/**
 * Kiểm tra xem người dùng có được phép xem giá vốn và biên lợi nhuận hay không (AC 3).
 * Chỉ Admin và Sales Manager (hoặc có quyền 'cost:read').
 */
export function canViewCost(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.can_view_cost !== undefined) return user.can_view_cost;
  return user.role === 'admin' || user.role === 'sales_manager' || hasPermission(user, Permissions.COST_READ);
}

/**
 * Kiểm tra xem người dùng có quyền thao tác ghi kho hay không (AC 4).
 * Sales và Sales Manager bị chặn. Chỉ Warehouse Staff, Warehouse Manager, Admin mới được phép.
 */
export function canWriteInventory(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.can_write_inventory !== undefined) return user.can_write_inventory;
  return hasPermission(user, Permissions.INVENTORY_WRITE);
}

/**
 * Custom Hook React usePermission
 */
export function usePermission(user: User | null | undefined) {
  return {
    can: (permission: string) => hasPermission(user, permission),
    canViewCost: canViewCost(user),
    canWriteInventory: canWriteInventory(user),
    role: user?.role || '',
    roleTitle: user?.role_title || user?.role || '',
  };
}
