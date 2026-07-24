import { prisma } from "@/lib/prisma";

export interface ProductAdminDTO {
  id: string;
  nomi: string;
  kelganNarx: number;
  sotuvNarx: number;
  miqdor: number;
  isActive: boolean;
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
  }));
}

export interface DebtDTO {
  id: string;
  mijozNomi: string;
  mijozTel: string | null;
  jamiSumma: number;
  tolangan: number;
  qolgan: number;
  isYopilgan: boolean;
  sana: string;
}

export async function listDebts(businessId: string): Promise<DebtDTO[]> {
  const debts = await prisma.debt.findMany({
    where: { businessId },
    orderBy: [{ isYopilgan: "asc" }, { createdAt: "desc" }],
  });
  return debts.map((d) => ({
    id: d.id,
    mijozNomi: d.mijozNomi,
    mijozTel: d.mijozTel,
    jamiSumma: d.jamiSumma,
    tolangan: d.tolangan,
    qolgan: d.jamiSumma - d.tolangan,
    isYopilgan: d.isYopilgan,
    sana: d.createdAt.toISOString(),
  }));
}

/** Ochiq qarzlar bo'yicha qolgan umumiy summa (jamiSumma − tolangan). */
export async function getOutstandingDebtTotal(businessId: string): Promise<number> {
  const res = await prisma.debt.aggregate({
    where: { businessId, isYopilgan: false },
    _sum: { jamiSumma: true, tolangan: true },
  });
  return (res._sum.jamiSumma ?? 0) - (res._sum.tolangan ?? 0);
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
