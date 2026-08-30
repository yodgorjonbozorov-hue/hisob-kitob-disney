import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { tolovGuruhiWhere, type TolovGuruhi } from "@/lib/tolovBolimi";
import type { Prisma } from "@prisma/client";

/**
 * XODIMLAR STATISTIKASI — sotuvchi/xodim kesimidagi zakaz va savdo hisobi.
 *
 * HAQIQAT MANBAI BITTA: kirim tranzaksiyalari. CRM buyurtmasi kirimga
 * ko'chirilganda Deal ↔ Transaction BIR-BIRGA bog'lanadi (Deal.transactionId
 * UNIQUE), ya'ni bitta real zakaz bu yerda ROSA BIR MARTA sanaladi —
 * buyurtmaning o'zi alohida qo'shilmaydi.
 *
 * BIRIKTIRISH QOIDASI: `sotuvchiId` ustun (savdo kimniki), u bo'lmasa (eski
 * yozuvlar) — `userId` (kim kiritgan bo'lsa, odatda sotuvchining o'zi).
 * Shu tufayli tarixiy yozuvlar statistikadan yo'qolmaydi.
 *
 * QARZ TO'LOVLARI CHIQARILADI: qarzga savdo kirim sifatida savdo kunida
 * to'liq summa bilan sanaladi (tolovTuri="qarz"); keyingi to'lov yozuvlari
 * ham kirim, lekin ular YANGI zakaz emas — sanalsa xodim savdosi ikki marta
 * oshirilardi. To'lov yozuvi `DebtPayment.transactionId` orqali aniqlanadi.
 */

export interface XodimQatori {
  id: string;
  ism: string;
  zakazlar: number;
  summa: number;
  /** O'rtacha zakaz (so'm, butun). */
  ortacha: number;
  /** Jami savdodagi ulush, foizda (0-100, bir xona aniqlik uchun ×10 emas — butun foiz). */
  ulush: number;
}

export interface XodimlarStatDTO {
  jamiZakaz: number;
  jamiSumma: number;
  topZakaz: { id: string; ism: string; zakazlar: number } | null;
  topSumma: { id: string; ism: string; summa: number } | null;
  xodimlar: XodimQatori[];
}

/** Davr sharti — listTransactions bilan bir xil o'qish (from/to inclusive kunlar). */
function sanaWhere(from: string, to: string): Prisma.DateTimeFilter {
  return {
    gte: dateOnlyStringToUTCDate(from),
    lt: new Date(dateOnlyStringToUTCDate(to).getTime() + 24 * 60 * 60 * 1000),
  };
}

/** Qarz to'lovi sifatida yozilgan kirim tranzaksiyalari id'lari (chiqarish uchun). */
async function qarzTolovTxIdlari(businessId: string): Promise<string[]> {
  const rows = await prisma.debtPayment.findMany({
    where: { businessId, transactionId: { not: null } },
    select: { transactionId: true },
  });
  return rows.map((r) => r.transactionId!).filter(Boolean);
}

function bazaWhere(businessId: string, from: string, to: string, tolovIdlar: string[]): Prisma.TransactionWhereInput {
  return {
    businessId,
    turi: "kirim",
    deletedAt: null,
    sana: sanaWhere(from, to),
    ...(tolovIdlar.length > 0 ? { id: { notIn: tolovIdlar } } : {}),
  };
}

export async function getXodimlarStatistika(params: {
  businessId: string;
  from: string;
  to: string;
}): Promise<XodimlarStatDTO> {
  const tolovIdlar = await qarzTolovTxIdlari(params.businessId);

  // Guruhlash IKKI ustun bo'yicha: biriktirish `sotuvchiId ?? userId` bo'lgani
  // uchun juftliklar JS'da xodimga jamlanadi (juftlik soni xodimlar sonidan
  // ko'p emas — yozuvlar soni qancha bo'lishidan qat'i nazar kichik).
  const guruhlar = await prisma.transaction.groupBy({
    by: ["sotuvchiId", "userId"],
    where: bazaWhere(params.businessId, params.from, params.to, tolovIdlar),
    _sum: { summa: true },
    _count: { _all: true },
  });

  const jam = new Map<string, { zakazlar: number; summa: number }>();
  for (const g of guruhlar) {
    const kim = g.sotuvchiId ?? g.userId;
    const m = jam.get(kim) ?? { zakazlar: 0, summa: 0 };
    m.zakazlar += g._count._all;
    m.summa += g._sum.summa ?? 0;
    jam.set(kim, m);
  }

  // Ismlar: nofaol/o'chirilgan xodim yozuvni YO'QOTMAYDI — nomi bilan qoladi.
  const userlar = await prisma.user.findMany({
    where: { id: { in: [...jam.keys()] } },
    select: { id: true, ism: true },
  });
  const ismlar = new Map(userlar.map((u) => [u.id, u.ism]));

  const jamiZakaz = [...jam.values()].reduce((s, m) => s + m.zakazlar, 0);
  const jamiSumma = [...jam.values()].reduce((s, m) => s + m.summa, 0);

  const xodimlar: XodimQatori[] = [...jam.entries()]
    .map(([id, m]) => ({
      id,
      ism: ismlar.get(id) ?? "Noma'lum xodim",
      zakazlar: m.zakazlar,
      summa: m.summa,
      ortacha: m.zakazlar > 0 ? Math.round(m.summa / m.zakazlar) : 0,
      ulush: jamiSumma > 0 ? Math.round((m.summa / jamiSumma) * 100) : 0,
    }))
    .sort((a, b) => b.summa - a.summa || b.zakazlar - a.zakazlar);

  const topZakaz = xodimlar.length
    ? [...xodimlar].sort((a, b) => b.zakazlar - a.zakazlar || b.summa - a.summa)[0]
    : null;
  const topSumma = xodimlar[0] ?? null;

  return {
    jamiZakaz,
    jamiSumma,
    topZakaz: topZakaz ? { id: topZakaz.id, ism: topZakaz.ism, zakazlar: topZakaz.zakazlar } : null,
    topSumma: topSumma ? { id: topSumma.id, ism: topSumma.ism, summa: topSumma.summa } : null,
    xodimlar,
  };
}

export interface XodimDetalParams {
  businessId: string;
  xodimId: string;
  from: string;
  to: string;
  categoryId?: string | null;
  tolov?: TolovGuruhi | null;
  page?: number;
  pageSize?: number;
}

export async function getXodimDetal(params: XodimDetalParams) {
  const tolovIdlar = await qarzTolovTxIdlari(params.businessId);

  const where: Prisma.TransactionWhereInput = {
    ...bazaWhere(params.businessId, params.from, params.to, tolovIdlar),
    // Biriktirish qoidasi yuqoridagi bilan AYNAN bir xil: sotuvchiId ustun,
    // eski (sotuvchisiz) yozuvlar — kim kiritgan bo'lsa o'shaniki.
    OR: [{ sotuvchiId: params.xodimId }, { sotuvchiId: null, userId: params.xodimId }],
  };
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.tolov) where.AND = [tolovGuruhiWhere(params.tolov)];

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));

  const [xodim, agg, items, total] = await Promise.all([
    prisma.user.findFirst({ where: { id: params.xodimId }, select: { id: true, ism: true } }),
    prisma.transaction.aggregate({ where, _sum: { summa: true }, _count: { _all: true } }),
    prisma.transaction.findMany({
      where,
      select: {
        id: true,
        summa: true,
        sana: true,
        izoh: true,
        tolovTuri: true,
        category: { select: { id: true, nomi: true } },
        account: { select: { turi: true } },
        crmBuyurtma: { select: { id: true, nomi: true } },
      },
      orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);

  const zakazlar = agg._count._all;
  const summa = agg._sum.summa ?? 0;

  return {
    xodim: xodim ? { id: xodim.id, ism: xodim.ism } : { id: params.xodimId, ism: "Noma'lum xodim" },
    stat: { zakazlar, summa, ortacha: zakazlar > 0 ? Math.round(summa / zakazlar) : 0 },
    items,
    total,
    page,
    pageSize,
  };
}

export type XodimDetalDTO = Awaited<ReturnType<typeof getXodimDetal>>;
