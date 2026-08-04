import { webhookCallback } from "grammy";

type UpdateHandler = (req: Request) => Promise<Response>;

let handleUpdate: UpdateHandler | null = null;

/**
 * Bot birinchi so'rovda yuklanadi (modul import bo'lganda emas).
 *
 * Sababi: `src/bot/bot.ts` TELEGRAM_BOT_TOKEN bo'lmasa import paytidayoq xato
 * tashlaydi. `next build` esa route modullarini import qiladi ("Collecting page
 * data") — natijada token yo'q muhitda butun build yiqilardi. Kechiktirilgan
 * yuklash bilan build env'siz ham o'tadi, token faqat haqiqiy webhook so'rovida
 * kerak bo'ladi.
 */
async function getHandler(): Promise<UpdateHandler> {
  if (!handleUpdate) {
    const { bot } = await import("@/bot/bot");
    handleUpdate = webhookCallback(bot, "std/http", {
      secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    }) as UpdateHandler;
  }
  return handleUpdate;
}

/** Production'da Telegram shu route'ga so'rov yuboradi (long-polling emas). */
export async function POST(req: Request) {
  try {
    const handler = await getHandler();
    return await handler(req);
  } catch (error) {
    console.error("Webhook xatosi:", error);
    return new Response("OK", { status: 200 });
  }
}
