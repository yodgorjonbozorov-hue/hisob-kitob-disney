// Bot foydalanuvchini chatId/kod bo'yicha global aniqlaydi — rawPrisma; keyingi amallar tenant kontekstida.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import type { User } from "@prisma/client";
import { rateLimit } from "@/lib/rateLimit";

export async function findUserByChatId(chatId: string) {
  return prisma.user.findUnique({ where: { telegramChatId: chatId } });
}

export type LinkResult =
  | { ok: true; user: User }
  | { ok: false; reason: "not_found" | "expired" | "chat_already_linked" | "juda_kop_urinish" };

/** Bir chatdan 10 daqiqada nechta kod sinab ko'rish mumkin. */
const KOD_URINISH_LIMIT = 5;
const KOD_URINISH_OYNA_MS = 10 * 60 * 1000;

/** "/kod 123456" orqali Telegram chatni tizimdagi foydalanuvchiga bog'laydi. */
export async function linkByCode(chatId: string, code: string): Promise<LinkResult> {
  // Kod 6 raqamli va 10 daqiqa yashaydi. Urinishlar cheklanmasa, hujumchi
  // bot orqali kodlarni ketma-ket sinab boshqa hisobga ulanib olishi mumkin.
  const rl = await rateLimit(`tgkod:${chatId}`, KOD_URINISH_LIMIT, KOD_URINISH_OYNA_MS);
  if (!rl.ok) {
    return { ok: false, reason: "juda_kop_urinish" };
  }

  const existingChat = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (existingChat) {
    return { ok: false, reason: "chat_already_linked" };
  }

  const user = await prisma.user.findFirst({
    where: { linkCode: code, isActive: true },
  });

  if (!user || !user.linkCodeExpiresAt || user.linkCodeExpiresAt.getTime() < Date.now()) {
    return { ok: false, reason: user ? "expired" : "not_found" };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: chatId, linkCode: null, linkCodeExpiresAt: null },
  });

  return { ok: true, user: updated };
}
