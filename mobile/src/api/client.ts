// Yagona API klient. Barcha so'rovlar shu yerdan o'tadi:
// - Authorization: Bearer <token> (SecureStore'dan)
// - X-Active-Business: <id> (biznes almashtirilganda)
// - Xatolarni yagona ApiError modeliga aylantiradi
import { getToken, clearSession, getActiveBusinessId } from '../auth/sessionStore';
import { API_URL } from '../utils/env';

export class ApiError extends Error {
  status: number;
  code?: string;
  billing?: boolean;

  constructor(status: number, message: string, code?: string, billing?: boolean) {
    super(message);
    this.status = status;
    this.code = code;
    this.billing = billing;
  }

  get sessiyaTugagan(): boolean {
    // 401 yoki sessionEpoch bekor qilingan 403
    return (
      this.status === 401 ||
      (this.status === 403 && this.message.includes('qaytadan tizimga kiring'))
    );
  }
}

export class NetworkError extends Error {
  constructor() {
    super("Internet aloqasi yo'q");
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean; // default true
  headers?: Record<string, string>;
}

let onUnauthorized: (() => void) | null = null;

// Sessiya tugaganda auth store logout qilishi uchun callback
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, headers = {} } = options;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    'x-balansa-client': 'mobile',
    ...headers,
  };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';

  if (auth) {
    const token = await getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
    const businessId = await getActiveBusinessId();
    if (businessId) finalHeaders['X-Active-Business'] = businessId;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }

  let data: { error?: string; code?: string; billing?: boolean } & Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok && response.status !== 202) {
    const message =
      typeof data.error === 'string' && data.error ? data.error : xatoMatni(response.status);
    const error = new ApiError(response.status, message, data.code, data.billing === true);
    if (error.sessiyaTugagan) {
      await clearSession();
      onUnauthorized?.();
    }
    throw error;
  }

  return data as T;
}

function xatoMatni(status: number): string {
  if (status === 401) return 'Avtorizatsiyadan o\'ting';
  if (status === 403) return "Ruxsat yo'q";
  if (status === 402) return 'Obuna muddati tugagan';
  if (status >= 500) return 'Server xatosi yuz berdi';
  return 'Xatolik yuz berdi';
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}
