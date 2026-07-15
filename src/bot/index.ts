import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { bot } from "./bot";
import { startMonthlyReportScheduler } from "./scheduler";

/** Faqat lokal rivojlantirish uchun — long polling. Production'da webhook ishlatiladi (src/app/api/telegram/webhook). */
async function main() {
  const me = await bot.api.getMe();
  console.log(`Bot ishga tushdi: @${me.username}`);
  startMonthlyReportScheduler(bot);
  await bot.start();
}

main()
  .catch((err) => {
    console.error("Bot ishga tushishda fatal xato:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
