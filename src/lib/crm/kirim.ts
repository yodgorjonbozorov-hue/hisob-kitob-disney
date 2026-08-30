import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { createTransactionTx } from "@/lib/services/transactionService";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { kunlikSinxron } from "@/lib/services/kunlik";
import { utcDateToDateOnlyString, todayDateOnlyString } from "@/lib/date";

/**
 * BUYURTMANI KIRIMGA O'TKAZISH.
 *
 * Bu CRM va moliya o'rtasidagi YAGONA ko'prik: CRM o'z hisob-kitobini
 * yuritmaydi — pul faqat shu yerda, Kirim modulining O'SHA
 * `Transaction` yozuvi sifatida paydo bo'ladi (kategoriya, kassa, kunlik
 * hisobot, hisobotlar — hammasi avvalgidek ishlaydi).
 *
 * DUBLIKATGA QARSHI UCH QATLAM (5-talab):
 *   1. Baza: `Deal.transactionId` UNIQUE + tranzaksiya ichida
 *      `updateMany({ transactionId: null })` — shart bajarilmasa 0 qator
 *      yangilanadi va butun tranzaksiya bekor qilinadi. Ya'ni ikki so'rov
 *      bir vaqtda kelsa ham ikkinchi kirim yozuvi BAZAGA TUSHMAYDI.
 *   2. Xizmat qatlami: boshida ochiq tekshiruv (foydalanuvchiga tushunarli xato).
 *   3. Frontend: tugma o'chiriladi ("Kirim yozilgan" ko'rsatiladi).
 * Uchinchisi faqat qulaylik uchun — kafolat birinchi qatlamda.
 */

/** Kategoriyasiz eski buyurtmalar uchun zaxira kategoriya. */
const ZAXIRA_KATEGORIYA = "Sotuv";

export interface KirimgaKochirishParams {
  businessId: string;
  dealId: string;
  userId: string;
  /** Qaysi kassaga tushdi (ixtiyoriy — berilmasa to'lov turiga mos kassa). */
  accountId?: string | null;
  /** "naqd" | "click" | "qarz" (ixtiyoriy). */
  tolovTuri?: string | null;
}

/** Kirim izohi: "Xizmat — Mijoz" (10-talabdagi ko'rinish). */
export function kirimIzohi(nomi: string, kontaktIsm: string | null | undefined): string {
  return kontaktIsm ? `${nomi} — ${kontaktIsm}` : nomi;
}

/**
 * Buyurtmadan kirim tranzaksiyasi yaratadi va uni buyurtmaga BIR MARTA
 * bog'laydi. Ikkinchi chaqiruv `BadRequestError` bilan rad etiladi.
 */
export async function kirimgaKochirish(params: KirimgaKochirishParams) {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    include: {
      contact: { select: { id: true, ism: true } },
      category: { select: { id: true, nomi: true, turi: true } },
    },
  });
  if (!deal) throw new ForbiddenError("Buyurtma topilmadi");
  if (deal.transactionId) {
    throw new BadRequestError("Bu buyurtma bo'yicha kirim allaqachon yozilgan");
  }
  if (deal.summa <= 0) {
    throw new BadRequestError("Buyurtma summasi kiritilmagan — avval narxni yozing");
  }
  if (deal.category && deal.category.turi !== "kirim") {
    throw new BadRequestError("Buyurtma kategoriyasi kirim turida emas");
  }

  const izoh = kirimIzohi(deal.nomi, deal.contact?.ism);
  // Kirim sanasi — BUYURTMA sanasi (kiritilmagan eski buyurtmalarda bugun).
  const sana = deal.sana ? utcDateToDateOnlyString(deal.sana) : todayDateOnlyString();

  // SOTUVCHI = buyurtma MAS'ULI (xodim statistikasi zakazni kim olgan bo'lsa
  // o'shanga yozadi), ko'chirishni kim bosgani emas. Mas'ul hisobi o'chirilgan
  // bo'lsa (FK bo'sh qolmasin) — ko'chiruvchining o'ziga tushadi. Buyurtma ↔
  // kirim BIR-BIRGA bog'langani uchun zakaz statistikada bir marta sanaladi.
  const masul = await prisma.user.findFirst({
    where: { id: deal.masulId },
    select: { id: true },
  });
  const sotuvchiId = masul?.id ?? params.userId;

  const txn = await runBusinessTx(params.businessId, async (tx) => {
    // Tranzaksiya ichida xom `tx` — HAR so'rovga `businessId` sharti QO'LDA
    // yoziladi (lib/db/businessTx.ts).
    const categoryId =
      deal.categoryId ?? (await ensureCategoryTx(tx, params.businessId, ZAXIRA_KATEGORIYA, "kirim"));

    const created = await createTransactionTx(tx, params.userId, params.businessId, {
      turi: "kirim",
      categoryId,
      summa: deal.summa,
      sana,
      izoh,
      accountId: params.accountId ?? null,
      tolovTuri: params.tolovTuri ?? null,
      sotuvchiId,
    });

    // ATOMIK BOG'LASH: `transactionId: null` sharti — poyga himoyasi.
    // 0 qator yangilansa (oradan boshqa so'rov ulgurgan) butun tranzaksiya
    // qaytariladi, ya'ni yuqoridagi kirim ham bazaga tushmaydi.
    const bogland = await tx.deal.updateMany({
      where: { id: deal.id, businessId: params.businessId, transactionId: null, deletedAt: null },
      data: { transactionId: created.id },
    });
    if (bogland.count !== 1) {
      throw new BadRequestError("Bu buyurtma bo'yicha kirim allaqachon yozilgan");
    }

    await tx.activity.create({
      data: {
        businessId: params.businessId,
        dealId: deal.id,
        contactId: deal.contactId,
        turi: "tizim",
        matn: `Kirimga o'tkazildi: ${izoh}`,
        userId: params.userId,
      },
    });

    return created;
  });

  // KUNLIK hisobot sinxroni tranzaksiyadan TASHQARIDA: `kunlikSinxron` o'zi
  // `runBusinessTx` ochadi, ichkarida chaqirilsa SQLite yozuv qulfida
  // deadlock bo'lardi (`transactionService.createTransaction` bilan bir xil).
  const kim = await prisma.user.findFirst({ where: { id: params.userId }, select: { ism: true } });
  await kunlikSinxron(txn, kim?.ism ?? null);

  return txn;
}

/** Buyurtmaga bog'langan kirim yozuvi (havola uchun). */
export async function buyurtmaKirimi(businessId: string, dealId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, businessId, deletedAt: null },
    select: { transactionId: true },
  });
  if (!deal?.transactionId) return null;
  return prisma.transaction.findFirst({
    where: { id: deal.transactionId, businessId },
    include: { category: { select: { id: true, nomi: true } } },
  });
}
