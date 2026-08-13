import { randomUUID } from "node:crypto";

/**
 * XATO KUZATUVI (TASK 3.3) — Sentry'ga SDK'SIZ yuborish.
 *
 * Nega SDK emas: Sentry store endpoint'i oddiy JSON POST qabul qiladi —
 * bitta `fetch` yetarli. SDK esa og'ir instrumentatsiya olib keladi va
 * loyihada "yangi paket qo'shma" qoidasi bor. `SENTRY_DSN` sozlanmagan
 * bo'lsa hech narsa qilinmaydi (fail-open — monitoring ixtiyoriy).
 *
 * QOIDA: bu funksiya HECH QACHON xato tashlamaydi va asosiy oqimni
 * sekinlashtirmaydi (3 soniyalik timeout) — monitoring yiqilgani uchun
 * foydalanuvchi amali yiqilishi mumkin emas.
 */

export function monitoringYoqilgan(): boolean {
  return Boolean(process.env.SENTRY_DSN);
}

/** DSN'dan ("https://<key>@<host>/<loyiha>") endpoint va kalitni ajratadi. */
function dsnniOch(dsn: string): { endpoint: string; key: string } | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!u.username || !projectId) return null;
    return {
      endpoint: `${u.protocol}//${u.host}/api/${projectId}/store/`,
      key: u.username,
    };
  } catch {
    return null;
  }
}

/**
 * Xatoni monitoring xizmatiga yuboradi. `joy` — xato qayerda ushlanagani
 * ("kunlikSinxron", "cron:zaxira", "api:500"...) — Sentry'da guruhlash uchun.
 */
export async function xatoniYubor(
  error: unknown,
  joy: string,
  kontekst?: Record<string, unknown>
): Promise<void> {
  try {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) return;
    const cfg = dsnniOch(dsn);
    if (!cfg) return;

    const err = error instanceof Error ? error : new Error(String(error));
    const event = {
      event_id: randomUUID().replace(/-/g, ""),
      timestamp: new Date().toISOString(),
      platform: "node",
      level: "error",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      tags: { joy },
      exception: {
        values: [{ type: err.name, value: err.message }],
      },
      extra: {
        stack: err.stack?.slice(0, 4000) ?? null,
        ...kontekst,
      },
    };

    await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${cfg.key}, sentry_client=balansa/1.0`,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Monitoringning o'zi yiqildi — jimgina o'tamiz (console allaqachon yozilgan).
  }
}
