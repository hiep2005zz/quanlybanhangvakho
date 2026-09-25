const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';
import { authenticatedFetch } from './api';

export type UserRole = 'admin' | 'sales' | 'warehouse';

export type ManagedUser = {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  territory: string;
  is_active: boolean;
  created_at: string;
};

export type UserInput = Omit<Pick<ManagedUser, 'full_name' | 'email' | 'phone' | 'role' | 'territory'>, never>;

export type UserList = {
  items: ManagedUser[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  }, token);
  if (response.status === 204) return undefined as T;
  const data = await response.json() as T & { detail?: { message?: string } | string; error?: { message?: string } };
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : data.detail?.message ?? data.error?.message;
    throw new Error(detail ?? 'Không thể thực hiện yêu cầu.');
  }
  return data;
}

export function getUsers(token: string, params: { search: string; role: string; isActive: string; page: number }) {
  const query = new URLSearchParams({ search: params.search, page: String(params.page), page_size: '20' });
  if (params.role) query.set('role', params.role);
  if (params.isActive) query.set('is_active', params.isActive);
  return request<UserList>(token, `/users?${query.toString()}`);
}

export function createUser(token: string, input: UserInput) {
  return request<{ user: ManagedUser; temporary_password: string; activation_link: string }>(token, '/users', { method: 'POST', body: JSON.stringify(input) });
}

export function updateUser(token: string, id: number, input: Partial<UserInput> & { is_active?: boolean }) {
  return request<ManagedUser>(token, `/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteUser(token: string, id: number) {
  return request<void>(token, `/users/${id}`, { method: 'DELETE' });
}
