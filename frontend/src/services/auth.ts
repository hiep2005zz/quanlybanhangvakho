const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

type MessageResponse = { message: string };

async function post<T>(path: string, body: object): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as { message?: string; detail?: string };
  if (!response.ok) {
    throw new Error(data.detail ?? 'Có lỗi xảy ra. Vui lòng thử lại.');
  }
  return data as T;
}

export function requestPasswordReset(email: string) {
  return post<MessageResponse>('/auth/forgot-password', { email });
}

export function resetPassword(token: string, newPassword: string) {
  return post<MessageResponse>('/auth/reset-password', { token, new_password: newPassword });
}
