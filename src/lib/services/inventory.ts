import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { createTransaction } from "@/lib/services/transactionService";
import { todayDateOnlyString } from "@/lib/date";

// Sotuv va qarz to'lovi uchun avtomatik ishlatiladigan kategoriyalar.
const SOTUV_KATEGORIYA = "Sotuv";
const QARZ_TOLOVI_KATEGORIYA = "Qarz to'lovi";
// Biz qarzdor bo'lgan qarzni to'laganda — chiqim kategoriyasi.
const QARZ_TOLASH_KATEGORIYA = "Qarz to'lash";
// Avto rejimi: mashina naqdga olinganda — chiqim kategoriyasi.
const MASHINA_XARIDI_KATEGORIYA = "Mashina xaridi";
// Mashinaga qilingan xarajatlar (ta'mirlash, bo'yoq...) — chiqim kategoriyasi.
const MASHINA_XARAJATI_KATEGORIYA = "Mashina xarajati";

/** Xarajat turlarining ko'rinadigan nomlari (UI, bot va tranzaksiya izohi uchun). */
export const XARAJAT_TURLARI = {
  tamirlash: "Ta'mirlash",
  boyoq: "Bo'yoq",
  yuvish: "Yuvish",
  rasmiylashtirish: "Rasmiylashtirish",
  ehtiyot_qism: "Ehtiyot qism",
  boshqa: "Boshqa",
} as const;

export type XarajatTuri = keyof typeof XARAJAT_TURLARI;

/** Biznes uchun kategoriyani topadi yoki yaratadi (sotuv/qarz avtomatik yozuvlari uchun). */
export async function ensureCategory(
  businessId: string,
  nomi: string,
  turi: "kirim" | "chiqim" = "kirim"
): Promise<string> {
  const existing = await prisma.category.findFirst({ where: { businessId, nomi, turi } });
  if (existing) return existing.id;
  const created = await prisma.category.create({ data: { businessId, nomi, turi } });
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
  /**
   * Haqiqiy kelishilgan narx (birlik uchun). Avto rejimida narx deyarli har doim
   * savdolashib belgilanadi — berilsa shu narx ishlatiladi va mahsulot kartochkasi
   * ham yangilanadi. Berilmasa rejadagi sotuv narxi olinadi.
   */
  narx?: number | null;
  userId: string;
}) {
  const product = await prisma.product.findFirst({
    where: { id: params.productId, businessId: params.businessId, isActive: true },
  });
  if (!product) throw new ForbiddenError("Mahsulot topilmadi");

  const kelishilganNarx = params.narx && params.narx > 0 ? Math.round(params.narx) : null;
  if (!kelishilganNarx && product.sotuvNarx <= 0) {
    throw new BadRequestError("Sotuv narxi kiritilmagan");
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

  const birlikNarx = kelishilganNarx ?? product.sotuvNarx;
  const tannarx = product.kelganNarx;
  const jamiSumma = birlikNarx * params.miqdor;

  // Kelishilgan narx boshqa bo'lsa — kartochkada ham haqiqiy narx tursin.
  if (kelishilganNarx && kelishilganNarx !== product.sotuvNarx) {
    await prisma.product.update({
      where: { id: product.id },
      data: { sotuvNarx: kelishilganNarx },
    });
  }

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
    // Qarz — daromad yozilmaydi, qarzdorlik yaratiladi (bizga qarzdor).
    await prisma.debt.create({
      data: {
        businessId: params.businessId,
        turi: "olinadigan",
        saleId: sale.id,
        productId: product.id,
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

/**
 * Qarz to'lovi — qarzni kamaytiradi va pul harakatini yozadi:
 *  - "olinadigan" (bizga qarzdor) → kirim tranzaksiya;
 *  - "beriladigan" (biz qarzdormiz) → chiqim tranzaksiya.
 */
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

  const beriladigan = debt.turi === "beriladigan";
  const categoryId = await ensureCategory(
    params.businessId,
    beriladigan ? QARZ_TOLASH_KATEGORIYA : QARZ_TOLOVI_KATEGORIYA,
    beriladigan ? "chiqim" : "kirim"
  );
  const txn = await createTransaction(params.userId, params.businessId, {
    turi: beriladigan ? "chiqim" : "kirim",
    categoryId,
    summa: params.summa,
    sana: todayDateOnlyString(),
    izoh: `${beriladigan ? "Qarz to'lash" : "Qarz to'lovi"}: ${debt.mijozNomi}`,
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

/**
 * Qo'lda qarzdorlik yaratish — ikki yo'nalishda ham.
 * Pul harakati YOZILMAYDI: kirim/chiqim tranzaksiya to'lov paytida yoziladi
 * (kassa usuli — recordDebtPayment).
 */
export async function createDebt(params: {
  businessId: string;
  turi: "olinadigan" | "beriladigan";
  mijozNomi: string;
  mijozTel?: string | null;
  jamiSumma: number;
  tolangan?: number;
  productId?: string | null;
  muddat?: string | null;
  izoh?: string | null;
  userId: string;
}) {
  const nomi = params.mijozNomi.trim();
  if (!nomi) throw new BadRequestError("Ism kiritilishi shart");
  if (params.jamiSumma <= 0) throw new BadRequestError("Summa musbat bo'lishi kerak");

  const tolangan = params.tolangan ?? 0;
  if (tolangan < 0 || tolangan > params.jamiSumma) {
    throw new BadRequestError("To'langan summa qarz summasidan ko'p bo'lmasligi kerak");
  }

  if (params.productId) {
    const product = await prisma.product.findFirst({
      where: { id: params.productId, businessId: params.businessId },
      select: { id: true },
    });
    if (!product) throw new ForbiddenError("Mahsulot topilmadi");
  }

  return prisma.debt.create({
    data: {
      businessId: params.businessId,
      turi: params.turi,
      mijozNomi: nomi,
      mijozTel: params.mijozTel?.trim() || undefined,
      jamiSumma: params.jamiSumma,
      tolangan,
      isYopilgan: tolangan >= params.jamiSumma,
      productId: params.productId || undefined,
      muddat: params.muddat ? new Date(params.muddat) : undefined,
      izoh: params.izoh?.trim() || undefined,
      userId: params.userId,
    },
  });
}

/**
 * AVTO REJIMI — avtoparkka mashina qabul qilish (bitta amalda):
 *  1) Product (bitta mashina) + StockEntry (1 dona, olingan narx snapshot);
 *  2) naqd olingan bo'lsa — chiqim tranzaksiya ("Mashina xaridi");
 *     qarzga olingan bo'lsa — "beriladigan" qarz (pul chiqimi to'lovda yoziladi).
 * Sotilganda foyda = sotuv narxi − olingan narx (getProductProfitability).
 */
export async function createAvtoMashina(params: {
  businessId: string;
  nomi: string;
  olinganNarx: number;
  sotuvNarx?: number | null;
  avtoYil?: number | null;
  avtoRaqam?: string | null;
  avtoRang?: string | null;
  izoh?: string | null;
  /** Mashina qanday olindi: naqd pulga yoki qarzga (egasiga keyin to'lanadi). */
  tolovTuri: "naqd" | "qarz";
  /** Qarzga olinganda — kimdan olingani (qarzdorlik shu nom bilan yuritiladi). */
  egasiNomi?: string | null;
  egasiTel?: string | null;
  userId: string;
}) {
  const nomi = params.nomi.trim();
  if (!nomi) throw new BadRequestError("Model kiritilishi shart");
  if (params.olinganNarx <= 0) throw new BadRequestError("Olingan narx kiritilishi shart");
  if (params.tolovTuri === "qarz" && !params.egasiNomi?.trim()) {
    throw new BadRequestError("Qarzga olishda mashina egasining ismi kiritilishi shart");
  }

  const product = await prisma.product.create({
    data: {
      businessId: params.businessId,
      nomi,
      kelganNarx: params.olinganNarx,
      sotuvNarx: params.sotuvNarx ?? 0,
      miqdor: 0, // qoldiqni StockEntry oshiradi
      avtoYil: params.avtoYil ?? undefined,
      avtoRaqam: params.avtoRaqam?.trim() || undefined,
      avtoRang: params.avtoRang?.trim() || undefined,
      izoh: params.izoh?.trim() || undefined,
    },
  });

  await createStockEntry({
    businessId: params.businessId,
    productId: product.id,
    miqdor: 1,
    birlikNarx: params.olinganNarx,
    userId: params.userId,
    izoh: params.tolovTuri === "qarz" ? `Qarzga olindi: ${params.egasiNomi!.trim()}` : "Naqdga olindi",
  });

  const belgi = [nomi, params.avtoRaqam?.trim()].filter(Boolean).join(" ");

  if (params.tolovTuri === "naqd") {
    const categoryId = await ensureCategory(params.businessId, MASHINA_XARIDI_KATEGORIYA, "chiqim");
    await createTransaction(params.userId, params.businessId, {
      turi: "chiqim",
      categoryId,
      summa: params.olinganNarx,
      sana: todayDateOnlyString(),
      izoh: `Mashina xaridi: ${belgi}`,
    });
  } else {
    await createDebt({
      businessId: params.businessId,
      turi: "beriladigan",
      mijozNomi: params.egasiNomi!.trim(),
      mijozTel: params.egasiTel,
      jamiSumma: params.olinganNarx,
      productId: product.id,
      izoh: `Mashina uchun: ${belgi}`,
      userId: params.userId,
    });
  }

  return prisma.product.findUnique({ where: { id: product.id } });
}

/**
 * MASHINAGA XARAJAT QO'SHISH (ta'mirlash, bo'yoq, yuvish, rasmiylashtirish...).
 *
 * Xarajat aynan shu mashinaga yoziladi — sof foyda hisobida sotuv narxidan
 * ham olingan narx, ham shu xarajatlar ayriladi (getProductProfitability).
 *
 * Pul harakati mashina xaridi bilan bir xil qoidada:
 *  - "naqd" → darhol chiqim tranzaksiya ("Mashina xarajati" kategoriyasi);
 *  - "qarz" → "beriladigan" qarz (ustaga keyin to'lanadi), chiqim to'lov paytida.
 * Ya'ni xarajatni bu yerdan kiritgandan keyin uni yana qo'lda chiqimga
 * yozish SHART EMAS — ikki marta hisoblanib ketadi.
 */
export async function addProductExpense(params: {
  businessId: string;
  productId: string;
  turi: XarajatTuri;
  summa: number;
  izoh?: string | null;
  tolovTuri?: "naqd" | "qarz";
  kimga?: string | null;
  userId: string;
}) {
  if (params.summa <= 0) throw new BadRequestError("Summa musbat bo'lishi kerak");

  const product = await prisma.product.findFirst({
    where: { id: params.productId, businessId: params.businessId },
  });
  if (!product) throw new ForbiddenError("Mashina topilmadi");

  const tolovTuri = params.tolovTuri ?? "naqd";
  const kimga = params.kimga?.trim();
  if (tolovTuri === "qarz" && !kimga) {
    throw new BadRequestError("Keyin to'lanadigan bo'lsa — kimga to'lanishi yozilishi shart");
  }

  const turiNomi = XARAJAT_TURLARI[params.turi];
  const belgi = [product.nomi, product.avtoRaqam].filter(Boolean).join(" ");
  const izoh = params.izoh?.trim() || undefined;

  let transactionId: string | undefined;
  let debtId: string | undefined;

  if (tolovTuri === "naqd") {
    const categoryId = await ensureCategory(params.businessId, MASHINA_XARAJATI_KATEGORIYA, "chiqim");
    const txn = await createTransaction(params.userId, params.businessId, {
      turi: "chiqim",
      categoryId,
      summa: params.summa,
      sana: todayDateOnlyString(),
      izoh: `${turiNomi}: ${belgi}${izoh ? ` — ${izoh}` : ""}`,
    });
    transactionId = txn.id;
  } else {
    const debt = await createDebt({
      businessId: params.businessId,
      turi: "beriladigan",
      mijozNomi: kimga!,
      jamiSumma: params.summa,
      productId: product.id,
      izoh: `${turiNomi}: ${belgi}`,
      userId: params.userId,
    });
    debtId = debt.id;
  }

  return prisma.productExpense.create({
    data: {
      businessId: params.businessId,
      productId: product.id,
      turi: params.turi,
      summa: params.summa,
      izoh,
      userId: params.userId,
      transactionId,
      debtId,
    },
  });
}

/**
 * Xarajatni o'chirish (xato kiritilganda). Naqd xarajat bo'lsa bog'langan
 * chiqim tranzaksiya ham o'chiriladi (soft delete) — kassa qoldig'i to'g'ri qoladi.
 * Qarzga yozilgan xarajat: qarz bo'yicha to'lov bo'lgan bo'lsa o'chirilmaydi.
 */
export async function deleteProductExpense(params: {
  businessId: string;
  expenseId: string;
  userId: string;
}) {
  const expense = await prisma.productExpense.findFirst({
    where: { id: params.expenseId, businessId: params.businessId },
  });
  if (!expense) throw new ForbiddenError("Xarajat topilmadi");

  if (expense.debtId) {
    const debt = await prisma.debt.findFirst({ where: { id: expense.debtId } });
    if (debt && debt.tolangan > 0) {
      throw new BadRequestError("Bu xarajat bo'yicha to'lov qilingan — avval qarzni tekshiring");
    }
    if (debt) await prisma.debt.delete({ where: { id: debt.id } });
  }

  if (expense.transactionId) {
    await prisma.transaction.updateMany({
      where: { id: expense.transactionId, businessId: params.businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  await prisma.productExpense.delete({ where: { id: expense.id } });
  return { ok: true };
}
