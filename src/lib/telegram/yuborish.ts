/**
 * TELEGRAM YUBORISH — qayta urinish bilan.
 *
 * ASOSIY QOIDA (spec 14): Telegram ishlamasa SAVDO BUZILMAYDI. Shuning
 * uchun bu funksiya HECH QACHON tashlamaydi — natijani `{ ok }` sifatida
 * qaytaradi, chaqiruvchi esa uni jurnalga yozadi. Sotuv tranzaksiyasi
 * allaqachon commit bo'lgan bo'ladi.
 *
 * QAYTA URINISH: maksimum 3 marta, qisqa o'suvchi kutish bilan. Bu
 * ATAYLAB kichik: kassir savdoni tugatib mijozga tovar berayotgan payt,
 * ekran soniyalab qotib turmasligi kerak. Uchalasi ham o'tmasa yozuv
 * "XATO" holatida qoladi va UI'da "Qayta yuborish" tugmasi chiqadi.
 */

/** Maksimal urinishlar soni (spec: "maksimum 3 marta"). */
export const MAX_URINISH = 3;

/** Urinishlar orasidagi kutish (ms) — 1-dan keyin 300, 2-dan keyin 900. */
const KUTISH_MS = [300, 900];

export interface YuborishNatija {
  ok: boolean;
  /** Nechta urinish qilindi (1..MAX_URINISH). */
  urinish: number;
  /** Xato matni (ok = false bo'lganda). */
  xato?: string;
}

/** Test va boshqa muhitlar uchun almashtiriladigan yuboruvchi. */
export type Yuboruvchi = (chatId: string, matn: string) => Promise<unknown>;

let yuboruvchi: Yuboruvchi | null = null;

/**
 * Yuboruvchini almashtiradi (testlar uchun). `null` — haqiqiy botga qaytish.
 *
 * Nega kerak: `@/bot/bot` import paytida TELEGRAM_BOT_TOKEN talab qiladi,
 * ya'ni testda uni import qilib bo'lmaydi. Shu ilgak orqali test soxta
 * yuboruvchi qo'yadi va "Telegram xato berdi" stsenariysini ham sinaydi.
 */
export function setTelegramYuboruvchi(fn: Yuboruvchi | null): void {
  yuboruvchi = fn;
}

/**
 * Haqiqiy bot. KECHIKTIRILGAN import: `@/bot/bot` moduli yuklanishida
 * token yo'q bo'lsa xato tashlaydi va `next build` yiqilardi (webhook
 * route'idagi bilan bir xil sabab).
 */
async function botYuboruvchi(chatId: string, matn: string): Promise<unknown> {
  const { bot } = await import("@/bot/bot");
  return bot.api.sendMessage(chatId, matn);
}

function kut(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function xatoMatni(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Matnni yuboradi; xato bo'lsa MAX_URINISH gacha qayta urinadi.
 *
 * Tashlamaydi — natija obyekt bilan qaytadi.
 */
export async function telegramYubor(chatId: string, matn: string): Promise<YuborishNatija> {
  const fn = yuboruvchi ?? botYuboruvchi;
  let oxirgiXato = "";

  for (let urinish = 1; urinish <= MAX_URINISH; urinish++) {
    try {
      await fn(chatId, matn);
      return { ok: true, urinish };
    } catch (e) {
      oxirgiXato = xatoMatni(e);
      if (urinish < MAX_URINISH) await kut(KUTISH_MS[urinish - 1] ?? 900);
    }
  }

  return { ok: false, urinish: MAX_URINISH, xato: oxirgiXato.slice(0, 500) };
}
