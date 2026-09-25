// frontend/src/services/api.ts
export const API_BASE_URL = 'http://localhost:8000/api/v1';

export const AUTH_STORAGE = {
  TOKEN: 'auth_token',
  USER: 'auth_user',
  EXPIRES_AT: 'auth_expires_at',
  EXPIRED_MESSAGE: 'auth_session_expired_message',
};

export interface User {
  username: string;
  full_name: string;
  role: string;
  roles?: string[];
  role_titles?: string[];
  permissions?: string[];
  role_title?: string;
  branch?: string;
  can_view_cost?: boolean;
  can_write_inventory?: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface ProductItem {
  id: number;
  code: string;
  name: string;
  category: string;
  stock: number;
  sell_price: number;
  cost_price?: number | null;
  profit_margin?: number | null;
  profit_per_unit?: number | null;
}

export interface ProductFinancialSummary {
  total_products: number;
  total_stock: number;
  total_sell_value: number;
  total_cost_value?: number | null;
  total_gross_profit?: number | null;
  average_margin_percent?: number | null;
}

export interface ProductListResponse {
  items: ProductItem[];
  total: number;
  user_role: string;
  is_cost_price_visible: boolean;
  summary?: ProductFinancialSummary;
}

export interface RoleInfoItem {
  role: string;
  title: string;
  badge_color: string;
  description: string;
  can_view_cost: boolean;
  can_write_inventory: boolean;
  permissions: string[];
}

export interface RoleMatrixResponse {
  roles: RoleInfoItem[];
  total_roles: number;
}

export interface InventoryTransaction {
  id: number;
  product_id: number;
  product_name: string;
  type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  performed_by: string;
  user_role: string;
  reason: string;
  created_at: string;
}

export interface InventoryResponse {
  status: string;
  message: string;
  product_id: number;
  current_stock: number;
  transaction?: InventoryTransaction;
}

// Interceptor callback list for session expiration
type SessionExpiredHandler = (message: string) => void;
const sessionExpiredHandlers: Set<SessionExpiredHandler> = new Set();

export function subscribeSessionExpired(handler: SessionExpiredHandler): () => void {
  sessionExpiredHandlers.add(handler);
  return () => {
    sessionExpiredHandlers.delete(handler);
  };
}

export function notifySessionExpired(message: string = 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.') {
  clearClientSession();
  sessionStorage.setItem(AUTH_STORAGE.EXPIRED_MESSAGE, message);

  // Đồng bộ URL với query param ?expired=true để trang login và khi reload luôn hiển thị thông báo
  try {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('expired', 'true');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  } catch {
    // ignore
  }

  sessionExpiredHandlers.forEach((handler) => handler(message));
}

export function saveClientSession(user: User, token: string, expiresInSeconds: number = 900) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  sessionStorage.setItem(AUTH_STORAGE.USER, JSON.stringify(user));
  sessionStorage.setItem(AUTH_STORAGE.TOKEN, token);
  sessionStorage.setItem(AUTH_STORAGE.EXPIRES_AT, expiresAt.toString());
  sessionStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
}

export function clearClientSession() {
  sessionStorage.removeItem(AUTH_STORAGE.TOKEN);
  sessionStorage.removeItem(AUTH_STORAGE.USER);
  sessionStorage.removeItem(AUTH_STORAGE.EXPIRES_AT);
}

export function getClientSession(): { user: User | null; token: string | null; expiresAt: number | null } {
  try {
    const userStr = sessionStorage.getItem(AUTH_STORAGE.USER);
    const token = sessionStorage.getItem(AUTH_STORAGE.TOKEN);
    const expiresAtStr = sessionStorage.getItem(AUTH_STORAGE.EXPIRES_AT);
    const user = userStr ? JSON.parse(userStr) : null;
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
    return { user, token, expiresAt };
  } catch {
    return { user: null, token: null, expiresAt: null };
  }
}

/**
 * Fetch wrapper with 401 Interceptor:
 * If server returns 401 (token revoked or expired), immediately clears auth and redirects with notification.
 */
export async function authenticatedFetch(input: string, init: RequestInit = {}, token?: string): Promise<Response> {
  const currentToken = token || sessionStorage.getItem(AUTH_STORAGE.TOKEN);
  const headers = new Headers(init.headers || {});
  if (currentToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
      let errorDetail = 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
      try {
        const cloned = response.clone();
        const data = await cloned.json();
        if (typeof data?.detail === 'string') {
          errorDetail = data.detail;
        } else if (data?.detail && typeof data.detail.message === 'string') {
          errorDetail = data.detail.message;
        }
      } catch {
        // ignore
      }

      notifySessionExpired(errorDetail);
      throw new Error(errorDetail);
    }

    return response;
  } catch (err: any) {
    throw err;
  }
}

/**
 * Validate token with server (/auth/me):
 * If token is revoked on server (401), authenticatedFetch intercepts it and kicks session.
 */
export async function validateSessionApi(token?: string): Promise<boolean> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
    }, token);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get current user profile from server (/auth/me) with fresh roles & permissions:
 */
export async function getMeApi(token?: string): Promise<User | null> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
    }, token);
    if (!response.ok) return null;
    const user: User = await response.json();
    return user;
  } catch {
    return null;
  }
}

export async function loginApi(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorDetail = typeof data.detail === 'object' ? data.detail : { message: data.detail };
    throw {
      status: response.status,
      message: errorDetail.message || 'Lỗi đăng nhập',
      lock_remaining_seconds: errorDetail.lock_remaining_seconds,
      remaining_attempts: errorDetail.remaining_attempts,
    };
  }

  saveClientSession(data.user, data.access_token, data.expires_in || 900);
  return data;
}

/**
 * Silent Refresh / Keep-Alive API:
 * Calls server to refresh token and sliding expiration.
 */
export async function refreshTokenApi(token: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    notifySessionExpired('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
    throw new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  if (!response.ok) {
    throw new Error('Không thể làm mới phiên đăng nhập.');
  }

  const data: LoginResponse = await response.json();
  saveClientSession(data.user, data.access_token, data.expires_in || 900);
  return data;
}

/**
 * Logout API:
 * Hủy / thu hồi token ngay lập tức phía server (Blacklist) và xóa sạch client session.
 */
export async function logoutApi(token: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (e) {
    console.warn('Network error while logging out on server:', e);
  } finally {
    clearClientSession();
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('auth_channel');
        channel.postMessage({ type: 'LOGOUT', timestamp: Date.now() });
        channel.close();
      }
    } catch {
      // ignore
    }
  }
}

export async function getProductsApi(token: string): Promise<ProductListResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/products`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    throw new Error('Không thể tải dữ liệu sản phẩm từ hệ thống.');
  }

  return response.json();
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password?: string;
}

export interface ChangePasswordResult {
  status: string;
  message: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export async function changePasswordApi(
  payload: ChangePasswordPayload,
  token: string
): Promise<ChangePasswordResult> {
  const response = await authenticatedFetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json();
  if (!response.ok) {
    let errorMsg = 'Đổi mật khẩu thất bại. Vui lòng thử lại.';
    if (typeof data?.detail === 'string') {
      errorMsg = data.detail;
    } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
      errorMsg = data.detail[0]?.msg || errorMsg;
    } else if (typeof data?.detail === 'object' && data.detail?.message) {
      errorMsg = data.detail.message;
    }
    throw new Error(errorMsg);
  }

  // Cập nhật token mới cho client session
  if (data.access_token && data.user) {
    saveClientSession(data.user, data.access_token, data.expires_in || 900);
  }

  return data;
}

export async function getRolesMatrixApi(): Promise<RoleMatrixResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/roles-matrix`);
  if (!response.ok) {
    throw new Error('Không thể tải ma trận vai trò từ hệ thống.');
  }
  return response.json();
}

export async function getInventoryTransactionsApi(token: string): Promise<InventoryTransaction[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/transactions`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể tải lịch sử biến động kho.');
  }
  return response.json();
}

export async function adjustStockApi(
  token: string,
  payload: { product_id: number; adjustment: number; reason: string }
): Promise<InventoryResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật kho (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function createStockReceiptApi(
  token: string,
  payload: { product_id: number; quantity: number; supplier: string; note?: string }
): Promise<InventoryResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi nhập kho (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function createStockIssueApi(
  token: string,
  payload: { product_id: number; quantity: number; destination: string; note?: string }
): Promise<InventoryResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xuất kho (Mã lỗi ${response.status})`);
  }
  return data;
}

export interface UserAccount {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: string;
  roles?: string[];
  role_title: string;
  role_titles?: string[];
  branch: string;
  is_active: boolean;
  status: string;
  lock_reason?: string | null;
  locked_at?: string | null;
  dealers_needing_handover: number;
  can_view_cost: boolean;
  can_write_inventory: boolean;
  badge_color: string;
}

export interface CustomerCreatePayload {
  full_name: string;
  email: string;
  phone: string;
  username?: string;
}

export interface CustomerCreateResponse {
  user: UserAccount;
  email_sent: boolean;
  message: string;
}

export interface UserCreatePayload {
  full_name: string;
  username?: string;
  email: string;
  password: string;
  role?: string;
  roles?: string[];
  branch?: string;
}

export interface UserUpdatePayload {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: string;
  roles?: string[];
  branch?: string;
  is_active?: boolean;
  status?: string;
  lock_reason?: string;
}

export interface DealerItem {
  id: number;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  assigned_sale_id?: number;
  needs_handover?: boolean;
}

export interface UserDealersResponse {
  user_id: number;
  username: string;
  full_name: string;
  is_locked: boolean;
  lock_reason?: string | null;
  total_dealers: number;
  dealers: DealerItem[];
}

export interface UserListResponse {
  users: UserAccount[];
  total: number;
}

export async function getUsersApi(token: string): Promise<UserListResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users`, {
    method: 'GET',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách người dùng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function createUserApi(token: string, payload: UserCreatePayload): Promise<UserAccount> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tạo người dùng mới (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function createCustomerApi(token: string, payload: CustomerCreatePayload): Promise<CustomerCreateResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tạo tài khoản kinh doanh (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function updateUserApi(token: string, username: string, payload: UserUpdatePayload): Promise<UserAccount> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật người dùng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function deleteUserApi(token: string, username: string): Promise<{ status: string; message: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xóa người dùng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function getUserDealersApi(token: string, username: string): Promise<UserDealersResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}/dealers`, {
    method: 'GET',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách đại lý (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function handoverDealersApi(
  token: string,
  username: string,
  newSaleUsername: string
): Promise<{ status: string; message: string; transferred_count: number }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}/handover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_sale_username: newSaleUsername }),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi bàn giao đại lý (Mã lỗi ${response.status})`);
  }
  return data;
}

