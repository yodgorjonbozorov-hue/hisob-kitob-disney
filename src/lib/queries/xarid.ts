import { prisma } from "@/lib/prisma";
import { tolovHolati, type TolovHolat } from "@/lib/validation/xarid";

export interface SupplierDTO {
  id: string;
  nomi: string;
  tel: string | null;
  manzil: string | null;
  izoh: string | null;
  isActive: boolean;
  /** Bog'langan tizim foydalanuvchisi (PRO) — to'lovlar uning kassasiga tushadi. */
  userId: string | null;
  /** Qabul qilingan buyurtmalar bo'yicha jami xarid summasi. */
  jamiXarid: number;
  /** Ochiq (qoralama + tasdiqlangan) buyurtmalar soni. */
  ochiqBuyurtma: number;
}

export async function listSuppliers(
  businessId: string,
  faqatFaol = false
): Promise<SupplierDTO[]> {
  const suppliers = await prisma.supplier.findMany({
    where: { businessId, deletedAt: null, ...(faqatFaol ? { isActive: true } : {}) },
    orderBy: [{ isActive: "desc" }, { nomi: "asc" }],
  });
  if (suppliers.length === 0) return [];

  // Ikkita `groupBy` — ta'minotchilar soni qancha bo'lsa ham 2 so'rov (N+1 emas).
  const [xaridlar, ochiqlar] = await Promise.all([
    prisma.purchaseOrder.groupBy({
      by: ["supplierId"],
      where: { businessId, holat: "qabul_qilingan" },
      _sum: { jamiSumma: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ["supplierId"],
      where: { businessId, holat: { in: ["qoralama", "tasdiqlangan"] } },
      _count: { _all: true },
    }),
  ]);
  const xaridMap = new Map(xaridlar.map((x) => [x.supplierId, x._sum.jamiSumma ?? 0]));
  const ochiqMap = new Map(ochiqlar.map((o) => [o.supplierId, o._count._all]));

  return suppliers.map((s) => ({
    id: s.id,
    nomi: s.nomi,
    tel: s.tel,
    manzil: s.manzil,
    izoh: s.izoh,
    isActive: s.isActive,
    userId: s.userId,
    jamiXarid: xaridMap.get(s.id) ?? 0,
    ochiqBuyurtma: ochiqMap.get(s.id) ?? 0,
  }));
}

export interface OrderSatrDTO {
  productId: string;
  productNomi: string;
  birlik: string;
  miqdor: number;
  birlikNarx: number;
  jamiSumma: number;
}

export interface OrderDTO {
  id: string;
  supplierId: string;
  supplierNomi: string;
  /** Ta'minotchi tizim useriga bog'langanmi (PRO) — to'lov kassa transferi bo'ladi. */
  supplierUserId: string | null;
  holat: string;
  sana: string;
  qabulSana: string | null;
  tolovTuri: string;
  jamiSumma: number;
  /** Qabul paytida to'langan qism (PRO qisman to'lov). */
  tolanganSumma: number;
  /** Qoldiq qarz (jami − to'langan); to'liq to'langanda 0. */
  qoldiqQarz: number;
  /** Pul oqimi holati — tovar holatidan alohida (lib/validation/xarid.ts). */
  tolovHolati: TolovHolat;
  izoh: string | null;
  satrlar: OrderSatrDTO[];
}

export async function listOrders(businessId: string, limit = 50): Promise<OrderDTO[]> {
  const orders = await prisma.purchaseOrder.findMany({
    where: { businessId },
    include: {
      supplier: { select: { nomi: true, userId: true } },
      items: { include: { product: { select: { nomi: true, birlik: true } } } },
    },
    orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return orders.map((o) => ({
    id: o.id,
    supplierId: o.supplierId,
    supplierNomi: o.supplier.nomi,
    supplierUserId: o.supplier.userId,
    holat: o.holat,
    sana: o.sana.toISOString(),
    qabulSana: o.qabulSana ? o.qabulSana.toISOString() : null,
    tolovTuri: o.tolovTuri,
    jamiSumma: o.jamiSumma,
    tolanganSumma: o.tolanganSumma,
    qoldiqQarz: Math.max(0, o.jamiSumma - o.tolanganSumma),
    tolovHolati: tolovHolati(o),
    izoh: o.izoh,
    satrlar: o.items.map((i) => ({
      productId: i.productId,
      productNomi: i.product.nomi,
      birlik: i.product.birlik,
      miqdor: i.miqdor,
      birlikNarx: i.birlikNarx,
      jamiSumma: i.jamiSumma,
    })),
  }));
}

export interface XaridStats {
  ochiqBuyurtma: number;
  /** Joriy oyda qabul qilingan xaridlar summasi. */
  oylikXarid: number;
  taminotchiSoni: number;
}

export async function getXaridStats(businessId: string, from: Date, to: Date): Promise<XaridStats> {
  const [ochiq, oylik, taminotchi] = await Promise.all([
    prisma.purchaseOrder.count({
      where: { businessId, holat: { in: ["qoralama", "tasdiqlangan"] } },
    }),
    prisma.purchaseOrder.aggregate({
      where: { businessId, holat: "qabul_qilingan", qabulSana: { gte: from, lt: to } },
      _sum: { jamiSumma: true },
    }),
    prisma.supplier.count({ where: { businessId, deletedAt: null, isActive: true } }),
  ]);
  return {
    ochiqBuyurtma: ochiq,
    oylikXarid: oylik._sum.jamiSumma ?? 0,
    taminotchiSoni: taminotchi,
  };
}
