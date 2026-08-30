import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { dateOnlyStringToUTCDate, monthRangeUTC } from "@/lib/date";
import type { VazifaCreateInput, VazifaUpdateInput, VazifaHolat } from "@/lib/validation/hr";
import { VAZIFA_HOLATLARI } from "@/lib/validation/hr";

/**
 * XODIM VAZIFALARI — mavjud `Task` jadvali ustida ishlaydi (alohida vazifa
 * tizimi ATAYLAB yaratilmagan): `Task.employeeId` to'ldirilgan yozuv xodim
 * vazifasi hisoblanadi. Xodim tizim hisobiga bog'langan bo'lsa `masulId`
 * o'sha user bo'ladi — vazifa CRM kanbanida ham ko'rinadi va Telegram
 * eslatmalari ishlaydi; bog'lanmagan bo'lsa `masulId` bergan boshqaruvchida
 * qoladi.
 */

export interface XodimVazifaDTO {
  id: string;
  nomi: string;
  izoh: string | null;
  holat: string;
  muhimlik: string;
  boshlanish: string | null;
  muddat: string | null;
  bajarildiAt: string | null;
  createdAt: string;
  /** Vazifani kim bergan (User ismi snapshot o'rniga o'qish payti olinadi). */
  berganIsm: string | null;
  /** Muddati o'tgan, hali yopilmagan. */
  kechikkan: boolean;
}

function kechikkanmi(t: { muddat: Date | null; holat: string }): boolean {
  if (!t.muddat) return false;
  if (t.holat === "BAJARILDI" || t.holat === "BEKOR") return false;
  return t.muddat.getTime() < Date.now();
}

function toDTO(
  t: {
    id: string;
    nomi: string;
    izoh: string | null;
    holat: string;
    muhimlik: string;
    boshlanish: Date | null;
    muddat: Date | null;
    bajarildiAt: Date | null;
    createdAt: Date;
    createdBy: string;
  },
  ismlar: Map<string, string>
): XodimVazifaDTO {
  return {
    id: t.id,
    nomi: t.nomi,
    izoh: t.izoh,
    holat: t.holat,
    muhimlik: t.muhimlik,
    boshlanish: t.boshlanish ? t.boshlanish.toISOString().slice(0, 10) : null,
    muddat: t.muddat ? t.muddat.toISOString().slice(0, 10) : null,
    bajarildiAt: t.bajarildiAt ? t.bajarildiAt.toISOString().slice(0, 10) : null,
    createdAt: t.createdAt.toISOString().slice(0, 10),
    berganIsm: ismlar.get(t.createdBy) ?? null,
    kechikkan: kechikkanmi(t),
  };
}

/** Xodim vazifalari ro'yxati. `oy` berilsa — o'sha oyga tegishlilari + barcha ochiq kechikkanlar. */
export async function listXodimVazifalari(
  businessId: string,
  employeeId: string,
  oy?: string
): Promise<XodimVazifaDTO[]> {
  const xodim = await prisma.employee.findFirst({
    where: { id: employeeId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!xodim) throw new ForbiddenError("Xodim topilmadi");

  const rows = await prisma.task.findMany({
    where: { businessId, employeeId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });

  let filtrlangan = rows;
  if (oy) {
    const { from, to } = monthRangeUTC(oy);
    filtrlangan = rows.filter((t) => {
      const sana = t.muddat ?? t.boshlanish ?? t.createdAt;
      // Oyga tegishli YOKI hali yopilmagan kechikkan vazifa (ko'zdan yo'qolmasin).
      return (sana >= from && sana < to) || kechikkanmi(t);
    });
  }

  const ismlar = new Map<string, string>();
  const idlar = [...new Set(filtrlangan.map((t) => t.createdBy))];
  if (idlar.length > 0) {
    const userlar = await prisma.user.findMany({
      where: { id: { in: idlar } },
      select: { id: true, ism: true },
    });
    for (const u of userlar) ismlar.set(u.id, u.ism);
  }

  return filtrlangan.map((t) => toDTO(t, ismlar));
}

/** Yangi xodim vazifasi (boshqaruvchi beradi). */
export async function createXodimVazifa(
  businessId: string,
  createdBy: string,
  data: VazifaCreateInput
) {
  const xodim = await prisma.employee.findFirst({
    where: { id: data.employeeId, businessId, deletedAt: null },
    select: { id: true, userId: true, ism: true },
  });
  if (!xodim) throw new ForbiddenError("Xodim topilmadi");

  if (data.boshlanish && data.muddat && data.boshlanish > data.muddat) {
    throw new BadRequestError("Boshlanish sanasi deadlinedan keyin bo'lishi mumkin emas");
  }

  // Xodim tizim hisobiga bog'langan bo'lsa mas'ul — o'sha user (kanban va
  // Telegram eslatmalari ishlashi uchun); bo'lmasa vazifani bergan odam.
  const masulId = xodim.userId ?? createdBy;

  const task = await prisma.task.create({
    data: {
      businessId,
      nomi: data.nomi.trim(),
      izoh: data.izoh?.trim() || null,
      masulId,
      employeeId: xodim.id,
      muhimlik: data.muhimlik,
      boshlanish: data.boshlanish ? dateOnlyStringToUTCDate(data.boshlanish) : null,
      muddat: data.muddat ? dateOnlyStringToUTCDate(data.muddat) : null,
      createdBy,
    },
  });

  // Telegram bildirishnoma (best-effort, o'ziga o'zi qo'ygan vazifaga emas).
  if (xodim.userId && xodim.userId !== createdBy) {
    notifyXodim(xodim.userId, task.nomi, task.muddat).catch((e) =>
      console.error("Xodim vazifasi bildirishnomasi xatosi:", e)
    );
  }

  return task;
}

async function notifyXodim(userId: string, nomi: string, muddat: Date | null) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { telegramChatId: true },
  });
  if (!user?.telegramChatId) return;
  const { bot } = await import("@/bot/bot");
  const muddatMatn = muddat ? `\nMuddat: ${muddat.toISOString().slice(0, 10)}` : "";
  await bot.api.sendMessage(user.telegramChatId, `📌 Sizga yangi vazifa: ${nomi}${muddatMatn}`);
}

/**
 * Vazifani yangilash. `faqatHolat = true` — oddiy xodim rejimi: faqat holat
 * o'zgaradi (o'z vazifasini bajarilgan deb belgilash), boshqa maydonlar
 * e'tiborga olinmaydi.
 */
export async function updateXodimVazifa(
  businessId: string,
  taskId: string,
  data: VazifaUpdateInput,
  faqatHolat = false
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, businessId, deletedAt: null, employeeId: { not: null } },
  });
  if (!task) throw new ForbiddenError("Vazifa topilmadi");

  if (data.holat && !VAZIFA_HOLATLARI.includes(data.holat as VazifaHolat)) {
    throw new BadRequestError("Noma'lum holat");
  }

  const holatQismi = data.holat
    ? {
        holat: data.holat,
        bajarildiAt: data.holat === "BAJARILDI" ? task.bajarildiAt ?? new Date() : null,
      }
    : {};

  if (faqatHolat) {
    if (!data.holat) throw new BadRequestError("Holat kiritilmagan");
    return prisma.task.update({ where: { id: task.id }, data: holatQismi });
  }

  return prisma.task.update({
    where: { id: task.id },
    data: {
      ...(data.nomi !== undefined ? { nomi: data.nomi.trim() } : {}),
      ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
      ...(data.muhimlik !== undefined ? { muhimlik: data.muhimlik } : {}),
      ...(data.boshlanish !== undefined
        ? { boshlanish: data.boshlanish ? dateOnlyStringToUTCDate(data.boshlanish) : null }
        : {}),
      ...(data.muddat !== undefined
        ? { muddat: data.muddat ? dateOnlyStringToUTCDate(data.muddat) : null }
        : {}),
      ...holatQismi,
    },
  });
}

/** Vazifani yumshoq o'chirish. */
export async function deleteXodimVazifa(businessId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, businessId, deletedAt: null, employeeId: { not: null } },
    select: { id: true },
  });
  if (!task) throw new ForbiddenError("Vazifa topilmadi");
  await prisma.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } });
  return { ok: true };
}

/**
 * Vazifa xodimning O'ZINIKI ekanini tekshiradi (oddiy xodim faqat o'z
 * vazifasining holatini o'zgartira oladi).
 */
export async function vazifaEgasimi(
  businessId: string,
  taskId: string,
  userId: string
): Promise<boolean> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, businessId, deletedAt: null, employeeId: { not: null } },
    select: { employee: { select: { userId: true } } },
  });
  return task?.employee?.userId === userId;
}
