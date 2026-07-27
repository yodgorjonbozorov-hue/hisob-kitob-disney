import { prisma } from "@/lib/prisma";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";

/**
 * Vazifalar xizmat qatlami (BOS-3). Tenant kontekstida chaqiriladi.
 * Holatlar sobit: OCHIQ -> JARAYONDA -> BAJARILDI (sodda 3 ustunli kanban).
 */

export const TASK_HOLATLAR = ["OCHIQ", "JARAYONDA", "BAJARILDI"] as const;
export type TaskHolat = (typeof TASK_HOLATLAR)[number];

export interface YangiVazifa {
  businessId: string;
  nomi: string;
  izoh?: string | null;
  masulId?: string | null; // berilmasa yaratuvchining o'zi
  muddat?: string | null; // "YYYY-MM-DD"
  dealId?: string | null;
  createdBy: string;
}

/** Yangi vazifa. Mas'ul boshqa odam bo'lsa Telegram bildirishnoma yuboriladi (best-effort). */
export async function createTask(params: YangiVazifa) {
  const masulId = params.masulId || params.createdBy;

  // Mas'ul shu tenantning faol foydalanuvchisi bo'lishi shart (scoped User o'qish).
  const masul = await prisma.user.findFirst({
    where: { id: masulId, isActive: true },
    select: { id: true, ism: true, telegramChatId: true },
  });
  if (!masul) throw new BadRequestError("Mas'ul foydalanuvchi topilmadi");

  // Bitimga bog'lansa — bitim shu biznesniki bo'lishi shart.
  if (params.dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
      select: { id: true },
    });
    if (!deal) throw new ForbiddenError("Bitim topilmadi");
  }

  const task = await prisma.task.create({
    data: {
      businessId: params.businessId,
      nomi: params.nomi.trim(),
      izoh: params.izoh?.trim() || null,
      masulId: masul.id,
      muddat: params.muddat ? new Date(params.muddat + "T00:00:00Z") : null,
      dealId: params.dealId ?? null,
      createdBy: params.createdBy,
    },
  });

  // Bildirishnoma: o'ziga o'zi qo'ygan vazifaga yuborilmaydi.
  if (masul.id !== params.createdBy && masul.telegramChatId) {
    notifyAssignee(masul.telegramChatId, task.nomi, task.muddat).catch((e) =>
      console.error("Vazifa bildirishnomasi xatosi:", e)
    );
  }

  return task;
}

/** Telegram orqali mas'ulga xabar (bot dinamik import — web bundle'ni og'irlashtirmaslik uchun). */
async function notifyAssignee(chatId: string, nomi: string, muddat: Date | null) {
  const { bot } = await import("@/bot/bot");
  const muddatMatn = muddat ? `\nMuddat: ${muddat.toLocaleDateString("ru-RU")}` : "";
  await bot.api.sendMessage(chatId, `📌 Sizga yangi vazifa: ${nomi}${muddatMatn}`);
}

/** Holatni o'zgartirish (kanban ko'chirish). */
export async function moveTask(params: { businessId: string; taskId: string; holat: string }) {
  if (!TASK_HOLATLAR.includes(params.holat as TaskHolat)) {
    throw new BadRequestError("Noma'lum holat");
  }
  const task = await prisma.task.findFirst({
    where: { id: params.taskId, businessId: params.businessId, deletedAt: null },
    select: { id: true },
  });
  if (!task) throw new ForbiddenError("Vazifa topilmadi");

  return prisma.task.update({
    where: { id: task.id },
    data: {
      holat: params.holat,
      bajarildiAt: params.holat === "BAJARILDI" ? new Date() : null,
    },
  });
}

/**
 * Cron: muddati BUGUN yoki O'TGAN, bajarilmagan vazifalar bo'yicha mas'ullarga
 * Telegram eslatma. Har kun uchun bir marta (AppSetting bilan dedupe).
 * Tenantlar bo'ylab rawPrisma bilan aylanadi (tizim ishi).
 */
export async function sendTaskReminders(botApi: {
  sendMessage: (chatId: string, text: string) => Promise<unknown>;
}): Promise<number> {
  const bugun = new Date().toISOString().slice(0, 10);
  const key = `taskReminder:${bugun}`;
  const already = await rawPrisma.appSetting.findUnique({ where: { key } });
  if (already) return 0;

  const endOfToday = new Date(bugun + "T23:59:59Z");
  const tasks = await rawPrisma.task.findMany({
    where: { deletedAt: null, holat: { not: "BAJARILDI" }, muddat: { lte: endOfToday } },
    select: { nomi: true, muddat: true, masulId: true },
  });

  // Mas'ul bo'yicha guruhlash — bitta odamga bitta xabar.
  const byUser = new Map<string, string[]>();
  for (const t of tasks) {
    const list = byUser.get(t.masulId) ?? [];
    list.push(t.nomi);
    byUser.set(t.masulId, list);
  }

  let sent = 0;
  for (const [userId, nomlar] of byUser) {
    try {
      const user = await rawPrisma.user.findUnique({
        where: { id: userId },
        select: { telegramChatId: true, isActive: true },
      });
      if (!user?.isActive || !user.telegramChatId) continue;
      const text = `⏰ Muddati kelgan vazifalar (${nomlar.length}):\n` + nomlar.slice(0, 10).map((n) => `• ${n}`).join("\n");
      await botApi.sendMessage(user.telegramChatId, text);
      sent++;
    } catch (error) {
      console.error("Vazifa eslatmasi xatosi:", error);
    }
  }

  await rawPrisma.appSetting.upsert({ where: { key }, update: { value: "sent" }, create: { key, value: "sent" } });
  return sent;
}
