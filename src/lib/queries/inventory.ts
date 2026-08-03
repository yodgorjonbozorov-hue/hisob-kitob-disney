import { prisma } from "@/lib/prisma";

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
}

/** Kassir uchun — miqdor RAQAMI ko'rsatilmaydi, faqat `mavjud` (bor/yo'q). */
export interface ProductKassirDTO {
  id: string;
  nomi: string;
  sotuvNarx: number;
  mavjud: boolean;
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
      .map((p) => ({ id: p.id, nomi: p.nomi, sotuvNarx: p.sotuvNarx, mavjud: p.miqdor > 0 }));
  }

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
  const products = await prisma.product.findMany({
    where: { businessId, isActive: true },
    select: { miqdor: true, kelganNarx: true },
  });
  return {
    turlarSoni: products.length,
    jamiQoldiq: products.reduce((a, p) => a + p.miqdor, 0),
    omborQiymati: products.reduce((a, p) => a + p.miqdor * p.kelganNarx, 0),
  };
}

export interface ProductProfitDTO {
  productId: string;
  nomi: string;
  sotilgan: number; // dona
  daromad: number; // Σ jamiSumma
  tannarx: number; // Σ tannarx × miqdor
  foyda: number; // daromad − tannarx
  marja: number; // foyda / daromad (%)
}

/** Mahsulot bo'yicha foydalilik (sotuvlar asosida). Kamayish tartibida foyda bo'yicha. */
export async function getProductProfitability(businessId: string): Promise<ProductProfitDTO[]> {
  const sales = await prisma.sale.findMany({
    where: { businessId },
    include: { product: { select: { nomi: true } } },
  });
  const map = new Map<string, ProductProfitDTO>();
  for (const s of sales) {
    let p = map.get(s.productId);
    if (!p) {
      p = { productId: s.productId, nomi: s.product.nomi, sotilgan: 0, daromad: 0, tannarx: 0, foyda: 0, marja: 0 };
      map.set(s.productId, p);
    }
    p.sotilgan += s.miqdor;
    p.daromad += s.jamiSumma;
    p.tannarx += s.tannarx * s.miqdor;
  }
  const list = Array.from(map.values());
  list.forEach((p) => {
    p.foyda = p.daromad - p.tannarx;
    p.marja = p.daromad > 0 ? Math.round((p.foyda / p.daromad) * 100) : 0;
  });
  return list.sort((a, b) => b.foyda - a.foyda);
}

export interface SaleDTO {
  id: string;
  productNomi: string;
  miqdor: number;
  jamiSumma: number;
  tolovTuri: string;
  mijozNomi: string | null;
  sana: string;
}

export async function listRecentSales(businessId: string, limit = 20): Promise<SaleDTO[]> {
  const sales = await prisma.sale.findMany({
    where: { businessId },
    include: { product: { select: { nomi: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return sales.map((s) => ({
    id: s.id,
    productNomi: s.product.nomi,
    miqdor: s.miqdor,
    jamiSumma: s.jamiSumma,
    tolovTuri: s.tolovTuri,
    mijozNomi: s.mijozNomi,
    sana: s.createdAt.toISOString(),
  }));
}
