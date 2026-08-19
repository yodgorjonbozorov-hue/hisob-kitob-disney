"use client";

/**
 * Control Center API chaqiruvi uchun yagona yordamchi.
 *
 * Server xatosi FOYDALANUVChI TILIDA qaytariladi; stack trace hech qachon
 * ko'rsatilmaydi (talab 56). Javobda `requestId` bo'lsa u saqlanadi —
 * foydalanuvchi shu raqamni aytib murojaat qila oladi.
 */

export interface SoroNatija<T> {
  ok: boolean;
  malumot: T | null;
  xato: string | null;
  requestId: string | null;
}

export async function soro<T = Record<string, unknown>>(
  url: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<SoroNatija<T>> {
  try {
    const res = await fetch(url, {
      method: opts.method ?? "POST",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const requestId = res.headers.get("x-vercel-id");

    if (res.status === 204) return { ok: true, malumot: null, xato: null, requestId };

    const turi = res.headers.get("content-type") ?? "";
    if (!turi.includes("application/json")) {
      if (res.ok) return { ok: true, malumot: null, xato: null, requestId };
      return { ok: false, malumot: null, xato: `Server xatosi (${res.status})`, requestId };
    }

    const malumot = (await res.json()) as T & { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        malumot: null,
        xato: malumot.error ?? `Server xatosi (${res.status})`,
        requestId,
      };
    }
    return { ok: true, malumot, xato: null, requestId };
  } catch {
    return {
      ok: false,
      malumot: null,
      xato: "Serverga ulanib bo'lmadi — internet aloqasini tekshiring",
      requestId: null,
    };
  }
}
