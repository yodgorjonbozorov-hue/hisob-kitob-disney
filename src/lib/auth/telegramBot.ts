/**
 * Kirish havolasi qaysi botga olib borishi.
 *
 * Havola xabarni HAQIQATAN qabul qiladigan botga — ya'ni `TELEGRAM_BOT_TOKEN`
 * egasiga — olib borishi shart, aks holda `/start login_...` hech qayerga
 * yetmaydi. Shuning uchun nom Telegram'ning o'zidan (`getMe`) olinadi va
 * jarayon davomida keshlanadi. Token yo'q yoki Telegram javob bermasa —
 * `TELEGRAM_BOT_USERNAME`, u ham bo'lmasa loyiha boti.
 */
/** Loyihaning ishlayotgan boti (2026-11-22 da egasi tasdiqladi; @balansauz_bot ishlatilmaydi). */
export const STANDART_BOT = "disney_hisob_kitob_bot";

let kesh: string | null = null;

export async function telegramBotNomi(): Promise<string> {
  if (kesh) return kesh;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(4000),
      });
      const data = (await res.json()) as { ok?: boolean; result?: { username?: string } };
      if (data.ok && data.result?.username) {
        kesh = data.result.username;
        return kesh;
      }
    } catch {
      // Tarmoq xatosi — zaxira qiymatga o'tamiz (keshlanmaydi, keyingi safar qayta uriniladi).
    }
  }
  return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || STANDART_BOT;
}

/** Faqat testlar uchun. */
export function telegramBotNomiKeshiniTozala(): void {
  kesh = null;
}
