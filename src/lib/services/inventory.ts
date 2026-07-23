import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { createTransaction } from "@/lib/services/transactionService";
import { todayDateOnlyString } from "@/lib/date";

// Sotuv va qarz to'lovi uchun avtomatik ishlatiladigan kirim kategoriyalari.
const SOTUV_KATEGORIYA = "Sotuv";
const QARZ_TOLOVI_KATEGORIYA = "Qarz to'lovi";

/** Biznes uchun kirim kategoriyani topadi yoki yaratadi (sotuv/qarz to'lovi avtomatik yozuvlari uchun). */
export async function ensureCategory(businessId: string, nomi: string): Promise<string> {
  const existing = await prisma.category.findFirst({ where: { businessId, nomi, turi: "kirim" } });
  if (existing) return existing.id;
  const created = await prisma.category.create({ data: { businessId, nomi, turi: "kirim" } });
  return created.id;
}

/** Ombor kirimi — mahsulot qoldig'ini oshiradi. Chiqim tranzaksiya YARATMAYDI. */
export async function createStockEntry(params: {
  businessId: string;
  productId: string;
  miqdor: number;
  birlikNarx?: number | null;
  userId: string;
  izoh?: string | null;
}) {
  const product = await prisma.product.findFirst({
    where: { id: params.productId, businessId: params.businessId },
  });
  if (!product) throw new ForbiddenError("Mahsulot topilmadi");

  const birlikNarx = params.birlikNarx ?? product.kelganNarx;

  await prisma.product.update({
    where: { id: product.id },
    data: { miqdor: { increment: params.miqdor } },
  });

  const entry = await prisma.stockEntry.create({
    data: {
      businessId: params.businessId,
      productId: product.id,
      miqdor: params.miqdor,
      birlikNarx,
      userId: params.userId,
      izoh: params.izoh ?? undefined,
    },
  });

  return entry;
}

/**
 * Sotuv — mahsulot qoldig'ini atomik kamaytiradi (overselling'dan himoya).
 * Naqd → kirim tranzaksiya; qarz → Debt (daromad yozilmaydi, to'lovda yoziladi).
 */
export async function createSale(params: {
  businessId: string;
  productId: string;
  miqdor: number;
  tolovTuri: "naqd" | "qarz";
  mijozNomi?: string | null;
  mijozTel?: string | null;
  userId: string;
}) {
  const product = await prisma.product.findFirst({
    where: { id: params.productId, businessId: params.businessId, isActive: true },
  });
  if (!product) throw new ForbiddenError("Mahsulot topilmadi");
  if (product.sotuvNarx <= 0) {
    throw new BadRequestError("Bu mahsulotning sotuv narxi hali qo'yilmagan");
  }
  if (params.tolovTuri === "qarz" && !params.mijozNomi?.trim()) {
    throw new BadRequestError("Qarzga sotishda mijoz nomi kiritilishi shart");
  }

  // Atomik shartli kamaytirish — yetarli qoldiq bo'lsagina bajariladi.
  const upd = await prisma.product.updateMany({
    where: { id: product.id, businessId: params.businessId, miqdor: { gte: params.miqdor } },
    data: { miqdor: { decrement: params.miqdor } },
  });
  if (upd.count === 0) {
    throw new BadRequestError("Omborda yetarli emas");
  }

  const birlikNarx = product.sotuvNarx;
  const tannarx = product.kelganNarx;
  const jamiSumma = birlikNarx * params.miqdor;

  const sale = await prisma.sale.create({
    data: {
      businessId: params.businessId,
      productId: product.id,
      miqdor: params.miqdor,
      birlikNarx,
      tannarx,
      jamiSumma,
      tolovTuri: params.tolovTuri,
      mijozNomi: params.mijozNomi?.trim() || undefined,
      mijozTel: params.mijozTel?.trim() || undefined,
      userId: params.userId,
    },
  });

  if (params.tolovTuri === "naqd") {
    // Naqd sotuv — darhol kirim tranzaksiya (kassa usuli).
    const categoryId = await ensureCategory(params.businessId, SOTUV_KATEGORIYA);
    const txn = await createTransaction(params.userId, params.businessId, {
      turi: "kirim",
      categoryId,
      summa: jamiSumma,
      sana: todayDateOnlyString(),
      izoh: `${product.nomi} × ${params.miqdor}`,
    });
    await prisma.sale.update({ where: { id: sale.id }, data: { transactionId: txn.id } });
  } else {
    // Qarz — daromad yozilmaydi, qarzdorlik yaratiladi.
    await prisma.debt.create({
      data: {
        businessId: params.businessId,
        saleId: sale.id,
        mijozNomi: params.mijozNomi!.trim(),
        mijozTel: params.mijozTel?.trim() || undefined,
        jamiSumma,
        userId: params.userId,
      },
    });
  }

  return prisma.sale.findUnique({
    where: { id: sale.id },
    include: { product: { select: { nomi: true } } },
  });
}

/** Qarz to'lovi — kirim tranzaksiya yaratadi va qarzni kamaytiradi. */
export async function recordDebtPayment(params: {
  businessId: string;
  debtId: string;
  summa: number;
  userId: string;
}) {
  const debt = await prisma.debt.findFirst({
    where: { id: params.debtId, businessId: params.businessId },
  });
  if (!debt) throw new ForbiddenError("Qarz topilmadi");
  if (debt.isYopilgan) throw new BadRequestError("Bu qarz allaqachon yopilgan");

  const qolgan = debt.jamiSumma - debt.tolangan;
  if (params.summa > qolgan) {
    throw new BadRequestError("To'lov summasi qolgan qarzdan ko'p");
  }

  const categoryId = await ensureCategory(params.businessId, QARZ_TOLOVI_KATEGORIYA);
  const txn = await createTransaction(params.userId, params.businessId, {
    turi: "kirim",
    categoryId,
    summa: params.summa,
    sana: todayDateOnlyString(),
    izoh: `Qarz to'lovi: ${debt.mijozNomi}`,
  });

  await prisma.debtPayment.create({
    data: {
      debtId: debt.id,
      businessId: params.businessId,
      summa: params.summa,
      userId: params.userId,
      transactionId: txn.id,
    },
  });

  const yangiTolangan = debt.tolangan + params.summa;
  const updated = await prisma.debt.update({
    where: { id: debt.id },
    data: {
      tolangan: yangiTolangan,
      isYopilgan: yangiTolangan >= debt.jamiSumma,
    },
  });

  return updated;
}
