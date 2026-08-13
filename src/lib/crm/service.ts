import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { ensureCategory } from "@/lib/services/inventory";
import { createTransaction } from "@/lib/services/transactionService";
import { todayTashkentDateOnlyString } from "@/lib/date";

/**
 * CRM xizmat qatlami. Barcha funksiyalar tenant kontekstida chaqiriladi —
 * prisma avtomatik izolyatsiyalangan.
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

/** Kanban ma'lumoti: bosqichlar + ochiq bitimlar (kontakt bilan). */
export async function getBoard(businessId: string) {
  await ensureStages(businessId);
  const [stages, deals] = await Promise.all([
    prisma.stage.findMany({ where: { businessId }, orderBy: { tartib: "asc" } }),
    prisma.deal.findMany({
      where: { businessId, deletedAt: null },
      include: { contact: { select: { ism: true, tel: true } } },
      orderBy: { createdAt: "desc" },
      take: 500, // sog'lom chegara; arxiv keyingi bosqichda
    }),
  ]);
  return { stages, deals };
}

export interface YangiBitim {
  businessId: string;
  nomi: string;
  summa?: number;
  contactId?: string | null;
  kontaktIsm?: string | null; // berilsa yangi kontakt yaratiladi
  kontaktTel?: string | null;
  muddat?: string | null; // "YYYY-MM-DD"
  manba?: string | null;
  userId: string;
}

/** Yangi bitim: kerak bo'lsa kontakt ham yaratiladi; birinchi OPEN bosqichga tushadi. */
export async function createDeal(params: YangiBitim) {
  await ensureStages(params.businessId);
  const firstStage = await prisma.stage.findFirst({
    where: { businessId: params.businessId, turi: "OPEN" },
    orderBy: { tartib: "asc" },
  });
  if (!firstStage) throw new BadRequestError("Bosqichlar topilmadi");

  let contactId = params.contactId ?? null;
  if (!contactId && params.kontaktIsm?.trim()) {
    // Telefon bo'yicha mavjud kontaktni qayta ishlatamiz (dublikat oldini olish).
    const tel = params.kontaktTel?.trim() || null;
    const existing = tel
      ? await prisma.contact.findFirst({ where: { businessId: params.businessId, tel, deletedAt: null } })
      : null;
    const contact =
      existing ??
      (await prisma.contact.create({
        data: {
          businessId: params.businessId,
          ism: params.kontaktIsm.trim(),
          tel,
          createdBy: params.userId,
        },
      }));
    contactId = contact.id;
  }

  const deal = await prisma.deal.create({
    data: {
      businessId: params.businessId,
      nomi: params.nomi.trim(),
      summa: params.summa ?? 0,
      stageId: firstStage.id,
      contactId,
      masulId: params.userId,
      manba: params.manba ?? "qolda",
      muddat: params.muddat ? new Date(params.muddat + "T00:00:00Z") : null,
    },
    include: { contact: { select: { ism: true, tel: true } } },
  });

  await prisma.activity.create({
    data: { businessId: params.businessId, dealId: deal.id, contactId, turi: "tizim", matn: "Bitim yaratildi", userId: params.userId },
  });

  return deal;
}

/**
 * Bitimni boshqa bosqichga ko'chirish. WON bosqichga o'tishda `kirimYoz` true
 * bo'lsa bitim summasi MOLIYA'ga kirim sifatida yoziladi (1 klik integratsiya).
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
    include: { contact: { select: { ism: true } } },
  });
  if (!deal) throw new ForbiddenError("Bitim topilmadi");

  const stage = await prisma.stage.findFirst({ where: { id: params.stageId, businessId: params.businessId } });
  if (!stage) throw new ForbiddenError("Bosqich topilmadi");

  const yopilyapti = stage.turi === "WON" || stage.turi === "LOST";
  let transactionId = deal.transactionId;

  if (stage.turi === "WON" && params.kirimYoz && !deal.transactionId && deal.summa > 0) {
    const categoryId = await ensureCategory(params.businessId, "Sotuv");
    const txn = await createTransaction(params.userId, params.businessId, {
      turi: "kirim",
      categoryId,
      summa: deal.summa,
      sana: todayTashkentDateOnlyString(),
      izoh: `CRM bitim: ${deal.nomi}${deal.contact ? ` (${deal.contact.ism})` : ""}`,
    });
    transactionId = txn.id;
  }

  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: {
      stageId: stage.id,
      yopilganAt: yopilyapti ? new Date() : null,
      transactionId,
    },
  });

  await prisma.activity.create({
    data: {
      businessId: params.businessId,
      dealId: deal.id,
      contactId: deal.contactId,
      turi: "tizim",
      matn:
        stage.turi === "WON" && transactionId && params.kirimYoz
          ? `"${stage.nomi}" bosqichiga o'tkazildi — kirim yozildi`
          : `"${stage.nomi}" bosqichiga o'tkazildi`,
      userId: params.userId,
    },
  });

  return updated;
}
