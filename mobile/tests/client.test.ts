// API klient testlari: auth header, biznes header, xato holatlari, sessiya tozalash
import { apiFetch, ApiError, NetworkError, setUnauthorizedHandler, qs } from '../src/api/client';
import {
  setToken,
  getToken,
  clearSession,
  setActiveBusinessId,
} from '../src/auth/sessionStore';

const fetchMock = jest.fn();
(global as Record<string, unknown>).fetch = fetchMock;

function javob(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

beforeEach(async () => {
  fetchMock.mockReset();
  await clearSession();
});

describe('apiFetch — sarlavhalar', () => {
  it('token va aktiv biznesni headerga qo‘shadi', async () => {
    await setToken('TESTTOKEN');
    await setActiveBusinessId('b42');
    fetchMock.mockResolvedValue(javob(200, { ok: true }));

    await apiFetch('/api/me');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/me');
    expect(opts.headers.Authorization).toBe('Bearer TESTTOKEN');
    expect(opts.headers['X-Active-Business']).toBe('b42');
    expect(opts.headers['x-balansa-client']).toBe('mobile');
  });

  it('auth:false bo‘lsa Authorization yubormaydi', async () => {
    await setToken('TESTTOKEN');
    fetchMock.mockResolvedValue(javob(200, { ok: true }));

    await apiFetch('/api/auth/login', { method: 'POST', body: { login: 'a', parol: 'b' }, auth: false });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
    expect(opts.body).toBe(JSON.stringify({ login: 'a', parol: 'b' }));
  });
});

describe('apiFetch — xato holatlari', () => {
  it('401 sessiyani tozalaydi va handler chaqiradi', async () => {
    await setToken('ESKI');
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(javob(401, { error: "Avtorizatsiyadan o'ting" }));

    await expect(apiFetch('/api/me')).rejects.toThrow(ApiError);
    expect(handler).toHaveBeenCalled();
    expect(await getToken()).toBeNull();
  });

  it('sessionEpoch bekor qilingan 403 ham sessiyani tugatadi', async () => {
    await setToken('ESKI');
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(
      javob(403, { error: "Kompaniya aniqlanmadi — qaytadan tizimga kiring" })
    );

    await expect(apiFetch('/api/me')).rejects.toThrow(ApiError);
    expect(handler).toHaveBeenCalled();
    expect(await getToken()).toBeNull();
  });

  it('oddiy 403 sessiyani TUGATMAYDI (rol yetmadi)', async () => {
    await setToken('TOKEN');
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(javob(403, { error: "Ruxsat yo'q" }));

    await expect(apiFetch('/api/dashboard/summary')).rejects.toThrow("Ruxsat yo'q");
    expect(handler).not.toHaveBeenCalled();
    expect(await getToken()).toBe('TOKEN');
  });

  it('402 billing belgisini oladi', async () => {
    fetchMock.mockResolvedValue(javob(402, { error: 'Obuna tugagan', billing: true }));
    try {
      await apiFetch('/api/transactions');
      fail('xato kutilgan edi');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).billing).toBe(true);
      expect((e as ApiError).status).toBe(402);
    }
  });

  it('403 MODULE_NOT_ENABLED kodini saqlaydi', async () => {
    fetchMock.mockResolvedValue(
      javob(403, { error: 'Modul yoqilmagan', code: 'MODULE_NOT_ENABLED' })
    );
    try {
      await apiFetch('/api/crm/board');
      fail('xato kutilgan edi');
    } catch (e) {
      expect((e as ApiError).code).toBe('MODULE_NOT_ENABLED');
    }
  });

  it('tarmoq uzilishida NetworkError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(apiFetch('/api/me')).rejects.toThrow(NetworkError);
  });

  it('202 (tasdiqlash kutilmoqda) xato EMAS', async () => {
    fetchMock.mockResolvedValue(javob(202, { tasdiqKutilmoqda: true, message: 'Kutilmoqda' }));
    const natija = await apiFetch<{ tasdiqKutilmoqda: boolean }>('/api/transactions', {
      method: 'POST',
      body: {},
    });
    expect(natija.tasdiqKutilmoqda).toBe(true);
  });
});

describe('qs', () => {
  it('bo‘sh qiymatlarni tashlaydi', () => {
    expect(qs({ a: 1, b: undefined, c: '', d: 'x' })).toBe('?a=1&d=x');
    expect(qs({})).toBe('');
  });
});

describe('sessiya saqlash', () => {
  it('clearSession token va biznesni o‘chiradi', async () => {
    await setToken('T');
    await setActiveBusinessId('B');
    await clearSession();
    expect(await getToken()).toBeNull();
  });
});
