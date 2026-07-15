import { webhookCallback } from "grammy";
import { bot } from "@/bot/bot";

/** Production'da Telegram shu route'ga so'rov yuboradi (long-polling emas). */
const handleUpdate = webhookCallback(bot, "std/http", {
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
});

export async function POST(req: Request) {
  try {
    return await handleUpdate(req);
  } catch (error) {
    console.error("Webhook xatosi:", error);
    return new Response("OK", { status: 200 });
  }
}
