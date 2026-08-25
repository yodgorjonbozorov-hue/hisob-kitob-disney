import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { kirimgaKochirish } from "@/lib/crm/kirim";

/**
 * CRM xizmat qatlami. Barcha funksiyalar tenant kontekstida chaqiriladi —
 * prisma avtomatik izolyatsiyalangan.
 *
 * CRM — KUNLIK BUYURTMALAR doskasi. Buyurtma kategoriyasi Kirim modulidagi
 * AYNAN o'sha `Category` jadvalidan olinadi (alohida CRM kategoriya tizimi
 * yo'q), pul esa faqat "Kirimga o'tkazish" bosilganda yoziladi
 * (`lib/crm/kirim.ts`).
 */

/** Yangi biznes uchun standart bosqichlar. */
export const DEFAULT_STAGES: { nomi: string; turi: "OPEN" | "WON" | "LOST" }[] = [
  { nomi: "Yangi", turi: "OPEN" },
  { nomi: "Aloqa qilindi", turi: "OPEN" },
  { nomi: "Taklif yuborildi", turi: "OPEN" },
  { nomi: "Yutildi", turi: "WON" },
  { nomi: "Yo'qotildi", turi: "LOST" },
];

/** Biznesda bosqichlar bo'lmasa standart to'plamni yaratadi (idempotent). */
export async function ensureStages(businessId: string) {
  const bor = await prisma.stage.count({ where: { businessId } });
  if (bor > 0) return;
  await prisma.stage.createMany({
    data: DEFAULT_STAGES.map((s, i) => ({ businessId, nomi: s.nomi, turi: s.turi, tartib: i })),
  });
}

/**
 * Kanban ma'lumoti: bosqichlar + buyurtmalar (kontakt, kategoriya va
 * bog'langan kirim bilan).
 */
export async function getBoard(businessId: string) {
  await ensureStages(businessId);
  const [stages, deals] = await Promise.all([
    prisma.stage.findMany({ where: { businessId }, orderBy: { tartib: "asc" } }),
    prisma.deal.findMany({
      where: { businessId, deletedAt: null },
      include: {
        contact: { select: { id: true, ism: true, tel: true } },
        category: { select: { id: true, nomi: true } },
      },
      orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
      take: 500, // sog'lom chegara; arxiv keyingi bosqichda
    }),
  ]);
  return { stages, deals };
}

export interface YangiBuyurtma {
  businessId: string;
  /** Xizmat/buyurtma nomi (masalan "Onajon Dekor"). */
  nomi: string;
  summa?: number;
  /** KIRIM kategoriyasi — Kirim modulidagi kategoriya id'si. */
  categoryId?: string | null;
  contactId?: string | null;
  kontaktIsm?: string | null; // berilsa yangi kontakt yaratiladi
  kontaktTel?: string | null;
  /** Buyurtma sanasi "YYYY-MM-DD". Berilmasa null (eski xulq). */
  sana?: string | null;
  muddat?: string | null; // "YYYY-MM-DD"
  manba?: string | null;
  izoh?: string | null;
  /** Mas'ul xodim. Berilmasa — buyurtmani kiritgan foydalanuvchi. */
  masulId?: string | null;
  /** Boshlang'ich holat (bosqich). Berilmasa — birinchi OPEN bosqich. */
  stageId?: string | null;
  userId: string;
}

/** Kategoriya shu biznesning KIRIM kategoriyasi ekanini tekshiradi. */
async function kirimKategoriyasi(businessId: string, categoryId: string): Promise<string> {
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, businessId },
    select: { id: true, turi: true },
  });
  if (!cat) throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
  if (cat.turi !== "kirim") throw new BadRequestError("Buyurtma kategoriyasi kirim turida bo'lishi kerak");
  return cat.id;
}

/** Kontakt: mavjudini qayta ishlatadi (telefon bo'yicha), bo'lmasa yaratadi. */
async function kontaktTop(params: YangiBuyurtma): Promise<string | null> {
  if (params.contactId) {
    const bor = await prisma.contact.findFirst({
      where: { id: params.contactId, businessId: params.businessId, deletedAt: null },
      select: { id: true },
    });
    if (!bor) throw new ForbiddenError("Mijoz bu biznesga tegishli emas");
    return bor.id;
  }
  if (!params.kontaktIsm?.trim()) return null;

  // Telefon bo'yicha mavjud kontaktni qayta ishlatamiz (dublikat oldini olish).
  const tel = params.kontaktTel?.trim() || null;
  const existing = tel
    ? await prisma.contact.findFirst({ where: { businessId: params.businessId, tel, deletedAt: null } })
    : null;
  if (existing) return existing.id;

  const contact = await prisma.contact.create({
    data: {
      businessId: params.businessId,
      ism: params.kontaktIsm.trim(),
      tel,
      createdBy: params.userId,
    },
  });
  return contact.id;
}

/**
 * Yangi buyurtma: kerak bo'lsa mijoz ham yaratiladi.
 * Holat berilmasa birinchi OPEN bosqichga tushadi.
 */
export async function createDeal(params: YangiBuyurtma) {
  await ensureStages(params.businessId);

  const stage = params.stageId
    ? await prisma.stage.findFirst({ where: { id: params.stageId, businessId: params.businessId } })
    : await prisma.stage.findFirst({
        where: { businessId: params.businessId, turi: "OPEN" },
        orderBy: { tartib: "asc" },
      });
  if (!stage) throw new BadRequestError("Bosqichlar topilmadi");

  const categoryId = params.categoryId ? await kirimKategoriyasi(params.businessId, params.categoryId) : null;
  const contactId = await kontaktTop(params);

  // Mas'ul xodim shu tenantning faol foydalanuvchisi bo'lishi shart.
  let masulId = params.userId;
  if (params.masulId && params.masulId !== params.userId) {
    const masul = await prisma.user.findFirst({ where: { id: params.masulId }, select: { id: true } });
    if (!masul) throw new ForbiddenError("Mas'ul xodim topilmadi");
    masulId = masul.id;
  }

  const deal = await prisma.deal.create({
    data: {
      businessId: params.businessId,
      nomi: params.nomi.trim(),
      summa: params.summa ?? 0,
      categoryId,
      stageId: stage.id,
      contactId,
      masulId,
      manba: params.manba ?? "qolda",
      sana: params.sana ? dateOnlyStringToUTCDate(params.sana) : null,
      muddat: params.muddat ? dateOnlyStringToUTCDate(params.muddat) : null,
      izoh: params.izoh?.trim() || null,
    },
    include: {
      contact: { select: { id: true, ism: true, tel: true } },
      category: { select: { id: true, nomi: true } },
    },
  });

  await prisma.activity.create({
    data: {
      businessId: params.businessId,
      dealId: deal.id,
      contactId,
      turi: "tizim",
      matn: "Buyurtma yaratildi",
      userId: params.userId,
    },
  });

  return deal;
}

/**
 * Buyurtmani boshqa holatga (bosqichga) ko'chirish.
 *
 * WON bosqichda `kirimYoz` berilsa kirim SHU YERDA emas, `kirimgaKochirish`
 * orqali yoziladi — dublikatga qarshi himoya (baza cheklovi + atomik
 * tranzaksiya) YAGONA joyda tursin.
 */
export async function moveDeal(params: {
  businessId: string;
  dealId: string;
  stageId: string;
  kirimYoz?: boolean;
  userId: string;
}) {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: { id: true, contactId: true, transactionId: true, summa: true },
  });
  if (!deal) throw new ForbiddenError("Buyurtma topilmadi");

  const stage = await prisma.stage.findFirst({ where: { id: params.stageId, businessId: params.businessId } });
  if (!stage) throw new ForbiddenError("Bosqich topilmadi");

  const yopilyapti = stage.turi === "WON" || stage.turi === "LOST";

  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: { stageId: stage.id, yopilganAt: yopilyapti ? new Date() : null },
  });

  await prisma.activity.create({
    data: {
      businessId: params.businessId,
      dealId: deal.id,
      contactId: deal.contactId,
      turi: "tizim",
      matn: `"${stage.nomi}" holatiga o'tkazildi`,
      userId: params.userId,
    },
  });

  // Yutildi + kirim yozish so'ralgan bo'lsa — bitta yo'ldan (dublikat himoyasi
  // o'sha yerda). Allaqachon ko'chirilgan bo'lsa jimgina o'tiladi.
  if (stage.turi === "WON" && params.kirimYoz && !deal.transactionId && deal.summa > 0) {
    await kirimgaKochirish({ businessId: params.businessId, dealId: deal.id, userId: params.userId });
    return prisma.deal.findFirst({ where: { id: deal.id, businessId: params.businessId } });
  }

  return updated;
}
