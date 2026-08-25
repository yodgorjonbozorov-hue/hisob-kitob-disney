import { apiFetch } from './client';
import type { LoginResponse, MeResponse } from './types';

export function loginRequest(login: string, parol: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { login, parol },
    auth: false,
  });
}

export function logoutRequest(): Promise<{ ok: boolean }> {
  // Bearer sessiya stateless — asosiy chiqish tokenni o'chirish (sessionStore.clearSession)
  return apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/api/me');
}

export function setActiveBusinessRequest(businessId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/api/me/active-business', {
    method: 'POST',
    body: { businessId },
  });
}
