import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

export async function findUserByChatId(chatId: string) {
  return prisma.user.findUnique({ where: { telegramChatId: chatId } });
}

export type LinkResult =
  | { ok: true; user: User }
  | { ok: false; reason: "not_found" | "expired" | "chat_already_linked" };

/** "/kod 123456" orqali Telegram chatni tizimdagi foydalanuvchiga bog'laydi. */
export async function linkByCode(chatId: string, code: string): Promise<LinkResult> {
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
