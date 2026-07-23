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
