import { prisma } from "@/lib/prisma";

export interface RuleDTO {
  id: string;
  categoryId: string | null;
  kategoriyaNomi: string | null;
  chegara: number;
  tasdiqlovchiRol: string;
  isActive: boolean;
  izoh: string | null;
}

export async function listRules(businessId: string): Promise<RuleDTO[]> {
  const rows = await prisma.approvalRule.findMany({
    where: { businessId, deletedAt: null },
    include: { category: { select: { nomi: true } } },
    orderBy: [{ isActive: "desc" }, { chegara: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    kategoriyaNomi: r.category?.nomi ?? null,
    chegara: r.chegara,
    tasdiqlovchiRol: r.tasdiqlovchiRol,
    isActive: r.isActive,
    izoh: r.izoh,
  }));
}

export interface RequestDTO {
  id: string;
  holat: string;
  summa: number;
  sana: string;
  kategoriyaNomi: string;
  kassaNomi: string | null;
  izoh: string | null;
  filial: string | null;
  sorovchiIsm: string;
  sorovchiId: string;
  tasdiqlovchiIsm: string | null;
  qarorSana: string | null;
  radSabab: string | null;
  transactionId: string | null;
  createdAt: string;
}

/**
 * `faqatOzi` — kassir/sotuvchi faqat O'Z so'rovlarini ko'radi (tranzaksiyalar
 * ro'yxatidagi ko'rinish qoidasi bilan bir xil).
 */
export async function listRequests(params: {
  businessId: string;
  holat?: string | null;
  userId?: string | null;
  limit?: number;
}): Promise<RequestDTO[]> {
  const rows = await prisma.approvalRequest.findMany({
    where: {
      businessId: params.businessId,
      ...(params.holat ? { holat: params.holat } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
    },
    include: {
      category: { select: { nomi: true } },
      account: { select: { nomi: true } },
      user: { select: { id: true, ism: true } },
      tasdiqlovchi: { select: { ism: true } },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 100,
  });

  return rows.map((r) => ({
    id: r.id,
    holat: r.holat,
    summa: r.summa,
    sana: r.sana.toISOString(),
    kategoriyaNomi: r.category.nomi,
    kassaNomi: r.account?.nomi ?? null,
    izoh: r.izoh,
    filial: r.filial,
    sorovchiIsm: r.user.ism,
    sorovchiId: r.user.id,
    tasdiqlovchiIsm: r.tasdiqlovchi?.ism ?? null,
    qarorSana: r.qarorSana ? r.qarorSana.toISOString() : null,
    radSabab: r.radSabab,
    transactionId: r.transactionId,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface TasdiqStats {
  kutilmoqda: number;
  kutilmoqdaSumma: number;
}

export async function getTasdiqStats(businessId: string): Promise<TasdiqStats> {
  const agg = await prisma.approvalRequest.aggregate({
    where: { businessId, holat: "kutilmoqda" },
    _count: { _all: true },
    _sum: { summa: true },
  });
  return { kutilmoqda: agg._count._all, kutilmoqdaSumma: agg._sum.summa ?? 0 };
}
