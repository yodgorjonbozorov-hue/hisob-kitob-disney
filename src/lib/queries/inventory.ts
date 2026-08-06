import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessQueryRaw, businessScope, songa } from "@/lib/db/businessRaw";

export interface ProductAdminDTO {
  id: string;
  nomi: string;
  kelganNarx: number;
  sotuvNarx: number;
  miqdor: number;
  isActive: boolean;
  izoh: string | null;
  // Avto rejimi maydonlari (umumiy bizneslarda null).
  avtoYil: number | null;
  avtoRaqam: string | null;
  avtoRang: string | null;
  /** Shu mahsulot/mashinaga yozilgan jami xarajat (ta'mirlash, bo'yoq...). */
  xarajat: number;
  sku: string | null;
  birlik: string;
  minQoldiq: number;
  /** Qoldiq o'z chegarasidan pastmi — ro'yxatda belgilanadi. */
  kamQoldi: boolean;
}

/** Kassir uchun — miqdor RAQAMI ko'rsatilmaydi, faqat `mavjud` (bor/yo'q). */
export interface ProductKassirDTO {
  id: string;
  nomi: string;
  sotuvNarx: number;
  mavjud: boolean;
  birlik: string;
  sku: string | null;
}

/** forKassir=true bo'lsa miqdor chiqarilmaydi — faqat mavjudlik. */
export async function listProducts(
  businessId: string,
  opts: { forKassir: boolean; faqatFaol?: boolean }
): Promise<ProductAdminDTO[] | ProductKassirDTO[]> {
  const products = await prisma.product.findMany({
    where: { businessId, ...(opts.faqatFaol ? { isActive: true } : {}) },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  if (opts.forKassir) {
    return products
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        nomi: p.nomi,
        sotuvNarx: p.sotuvNarx,
        mavjud: p.miqdor > 0,
        birlik: p.birlik,
        sku: p.sku,
      }));
  }

  const xarajatlar = await getExpenseTotalsByProduct(businessId);

  return products.map((p) => ({
    id: p.id,
    nomi: p.nomi,
    kelganNarx: p.kelganNarx,
    sotuvNarx: p.sotuvNarx,
    miqdor: p.miqdor,
    isActive: p.isActive,
    izoh: p.izoh,
    avtoYil: p.avtoYil,
    avtoRaqam: p.avtoRaqam,
    avtoRang: p.avtoRang,
    xarajat: xarajatlar[p.id] ?? 0,
    sku: p.sku,
    birlik: p.birlik,
    minQoldiq: p.minQoldiq,
    kamQoldi: p.minQoldiq > 0 && p.miqdor <= p.minQoldiq,
  }));
}

export interface DebtDTO {
  id: string;
  /** "olinadigan" — bizga qarzdor; "beriladigan" — biz qarzdormiz. */
  turi: string;
  mijozNomi: string;
  mijozTel: string | null;
  jamiSumma: number;
  tolangan: number;
  qolgan: number;
  isYopilgan: boolean;
  sana: string;
  muddat: string | null;
  izoh: string | null;
  /** Qarz bog'langan mahsulot/mashina nomi (bo'lsa). */
  productNomi: string | null;
}

export async function listDebts(businessId: string): Promise<DebtDTO[]> {
  const debts = await prisma.debt.findMany({
    where: { businessId },
    include: { product: { select: { nomi: true, avtoRaqam: true } } },
    orderBy: [{ isYopilgan: "asc" }, { createdAt: "desc" }],
  });
  return debts.map((d) => ({
    id: d.id,
    turi: d.turi,
    mijozNomi: d.mijozNomi,
    mijozTel: d.mijozTel,
    jamiSumma: d.jamiSumma,
    tolangan: d.tolangan,
    qolgan: d.jamiSumma - d.tolangan,
    isYopilgan: d.isYopilgan,
    sana: d.createdAt.toISOString(),
    muddat: d.muddat ? d.muddat.toISOString() : null,
    izoh: d.izoh,
    productNomi: d.product ? [d.product.nomi, d.product.avtoRaqam].filter(Boolean).join(" · ") : null,
  }));
}

/**
 * Ochiq qarzlar bo'yicha qolgan summa (jamiSumma − tolangan).
 * turi berilmasa — hamma yo'nalish bo'yicha (eski xatti-harakat).
 */
export async function getOutstandingDebtTotal(
  businessId: string,
  turi?: "olinadigan" | "beriladigan"
): Promise<number> {
  const res = await prisma.debt.aggregate({
    where: { businessId, isYopilgan: false, ...(turi ? { turi } : {}) },
    _sum: { jamiSumma: true, tolangan: true },
  });
  return (res._sum.jamiSumma ?? 0) - (res._sum.tolangan ?? 0);
}

export interface QarzJamiDTO {
  /** Bizga qarzdorlar — kelishi kerak bo'lgan pul. */
  olinadigan: number;
  /** Biz qarzdormiz — to'lanishi kerak bo'lgan pul. */
  beriladigan: number;
  /** Sof holat: olinadigan − beriladigan. */
  sof: number;
}

/** Ikki yo'nalish bo'yicha ochiq qarzlar yakuni. */
export async function getDebtTotals(businessId: string): Promise<QarzJamiDTO> {
  const rows = await prisma.debt.groupBy({
    by: ["turi"],
    where: { businessId, isYopilgan: false },
    _sum: { jamiSumma: true, tolangan: true },
  });
  const jami = (t: string) => {
    const r = rows.find((x) => x.turi === t);
    return (r?._sum.jamiSumma ?? 0) - (r?._sum.tolangan ?? 0);
  };
  const olinadigan = jami("olinadigan");
  const beriladigan = jami("beriladigan");
  return { olinadigan, beriladigan, sof: olinadigan - beriladigan };
}

export interface OmborStats {
  turlarSoni: number;
  jamiQoldiq: number;
  omborQiymati: number; // Σ miqdor × kelganNarx (tannarx bo'yicha)
}

export async function getOmborStats(businessId: string): Promise<OmborStats> {
  const [products, xarajatlar] = await Promise.all([
    prisma.product.findMany({
      where: { businessId, isActive: true },
      select: { id: true, miqdor: true, kelganNarx: true },
    }),
    getExpenseTotalsByProduct(businessId),
  ]);
  return {
    turlarSoni: products.length,
    jamiQoldiq: products.reduce((a, p) => a + p.miqdor, 0),
    // Sotilmagan mashinaga qilingan xarajat ham avtoparkka tikilgan puldir.
    omborQiymati: products.reduce(
      (a, p) => a + p.miqdor * p.kelganNarx + (p.miqdor > 0 ? xarajatlar[p.id] ?? 0 : 0),
      0
    ),
  };
}

export interface ProductProfitDTO {
  productId: string;
  nomi: string;
  sotilgan: number; // dona
  daromad: number; // Σ jamiSumma
  tannarx: number; // Σ tannarx × miqdor
  /** Shu mahsulot/mashinaga yozilgan xarajatlar (ta'mirlash, bo'yoq...). */
  xarajat: number;
  foyda: number; // daromad − tannarx − xarajat
  marja: number; // foyda / daromad (%)
}

/**
 * Mahsulot bo'yicha foydalilik (sotuvlar asosida). Kamayish tartibida foyda bo'yicha.
 * Avto rejimida sof foyda = sotilgan narx − olingan narx − mashinaga qilingan xarajatlar.
 */
export async function getProductProfitability(businessId: string): Promise<ProductProfitDTO[]> {
  // Ilgari BARCHA sotuvlar RAM'ga yuklanib JS'da guruhlanardi — 100 000 sotuvli
  // biznesda bu serverni yiqitardi. Endi guruhlash SQL'da (`SUM(tannarx*miqdor)`
  // ni Prisma qila olmaydi, shuning uchun xom so'rov — tenant sharti SQL ichida).
  const rows = await businessQueryRaw<{
    productId: string;
    nomi: string;
    sotilgan: unknown;
    daromad: unknown;
    tannarx: unknown;
    xarajat: unknown;
  }>(Prisma.sql`
    SELECT
      s."productId"                     AS productId,
      p."nomi"                          AS nomi,
      SUM(s."miqdor")                   AS sotilgan,
      SUM(s."jamiSumma")                AS daromad,
      SUM(s."tannarx" * s."miqdor")     AS tannarx,
      COALESCE((
        SELECT SUM(e."summa") FROM "ProductExpense" e
        WHERE e."productId" = s."productId" AND e."businessId" = s."businessId"
      ), 0)                             AS xarajat
    FROM "Sale" s
    JOIN "Business" b ON b."id" = s."businessId"
    JOIN "Product" p ON p."id" = s."productId"
    WHERE ${businessScope("s", businessId)} AND s."deletedAt" IS NULL
    GROUP BY s."productId", p."nomi"
  `);

  return rows
    .map((r) => {
      const daromad = songa(r.daromad);
      const tannarx = songa(r.tannarx);
      const xarajat = songa(r.xarajat);
      const foyda = daromad - tannarx - xarajat;
      return {
        productId: r.productId,
        nomi: r.nomi,
        sotilgan: songa(r.sotilgan),
        daromad,
        tannarx,
        xarajat,
        foyda,
        marja: daromad > 0 ? Math.round((foyda / daromad) * 100) : 0,
      };
    })
    .sort((a, b) => b.foyda - a.foyda);
}

export interface ProductExpenseDTO {
  id: string;
  productId: string;
  turi: string;
  summa: number;
  izoh: string | null;
  /** Keyin to'lanadigan (qarzga yozilgan) xarajatmi. */
  qarzga: boolean;
  sana: string;
}

/** Bitta mahsulot/mashinaning xarajatlari — kartochkada ko'rsatiladi. */
export async function listProductExpenses(
  businessId: string,
  productId: string
): Promise<ProductExpenseDTO[]> {
  const rows = await prisma.productExpense.findMany({
    where: { businessId, productId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((x) => ({
    id: x.id,
    productId: x.productId,
    turi: x.turi,
    summa: x.summa,
    izoh: x.izoh,
    qarzga: !!x.debtId,
    sana: x.createdAt.toISOString(),
  }));
}

/** Biznesdagi har mahsulot bo'yicha jami xarajat: { productId: summa }. */
export async function getExpenseTotalsByProduct(businessId: string): Promise<Record<string, number>> {
  const rows = await prisma.productExpense.groupBy({
    by: ["productId"],
    where: { businessId },
    _sum: { summa: true },
  });
  return Object.fromEntries(rows.map((r) => [r.productId, r._sum.summa ?? 0]));
}

export interface SaleDTO {
  id: string;
  productNomi: string;
  miqdor: number;
  jamiSumma: number;
  tolovTuri: string;
  mijozNomi: string | null;
  sana: string;
  /** Bekor qilingan sotuv — ro'yxatda chizilgan holda ko'rsatiladi. */
  bekorQilingan: boolean;
  bekorSabab: string | null;
}

/**
 * So'nggi sotuvlar. `sana` bo'yicha saralanadi (createdAt emas) — orqaga sana
 * bilan kiritilgan sotuv o'z o'rniga tushishi kerak.
 * Bekor qilinganlar ham ko'rsatiladi (ataylab): kassir nima bo'lganini ko'rsin.
 */
export async function listRecentSales(businessId: string, limit = 20): Promise<SaleDTO[]> {
  const sales = await prisma.sale.findMany({
    where: { businessId },
    include: { product: { select: { nomi: true } } },
    orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return sales.map((s) => ({
    id: s.id,
    productNomi: s.product.nomi,
    miqdor: s.miqdor,
    jamiSumma: s.jamiSumma,
    tolovTuri: s.tolovTuri,
    mijozNomi: s.mijozNomi,
    sana: s.sana.toISOString(),
    bekorQilingan: s.deletedAt !== null,
    bekorSabab: s.cancelReason,
  }));
}

export interface StockAdjustmentDTO {
  id: string;
  productNomi: string;
  turi: string;
  eskiMiqdor: number;
  yangiMiqdor: number;
  farq: number;
  sabab: string;
  sana: string;
}

/** So'nggi inventarizatsiya va hisobdan chiqarishlar (ombor sahifasi uchun). */
export async function listStockAdjustments(
  businessId: string,
  limit = 30
): Promise<StockAdjustmentDTO[]> {
  const rows = await prisma.stockAdjustment.findMany({
    where: { businessId },
    include: { product: { select: { nomi: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    productNomi: r.product.nomi,
    turi: r.turi,
    eskiMiqdor: r.eskiMiqdor,
    yangiMiqdor: r.yangiMiqdor,
    farq: r.farq,
    sabab: r.sabab,
    sana: r.createdAt.toISOString(),
  }));
}
