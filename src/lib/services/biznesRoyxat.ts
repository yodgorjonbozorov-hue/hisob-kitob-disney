import { prisma } from "@/lib/prisma";

/**
 * BIZNESLAR RO'YXATI UCHUN AGREGATSIYA (Bizneslar sahifasi).
 *
 * Nega alohida modul: sahifada har biznes uchun kategoriya, tranzaksiya va
 * xodim soni hamda oxirgi faollik ko'rsatiladi. Buni biznes bo'yicha aylanib
 * hisoblash N+1 bo'lardi — 100 biznesda 400+ so'rov. Shuning uchun bu yerda
 * hammasi BIZNESLAR SONIDAN QAT'I NAZAR bir nechta guruh-so'rov bilan
 * olinadi va JS tomonda birlashtiriladi.
 *
 * Barcha so'rovlar tenant-scoped `@/lib/prisma` orqali — begona tenant
 * biznesi bu yerga umuman tushmaydi (lib/db/tenantDb.ts).
 */

export interface BiznesStat {
  id: string;
  nomi: string;
  isActive: boolean;
  /** "umumiy" | "avto" — ombor moduli qaysi rejimda ishlaydi (lib/biznesTuri.ts). */
  turi: string;
  omborli: boolean;
  magazin: boolean;
  shaxsiyKassa: boolean;
  /** ISO satr — client komponentga Date o'rniga shu uzatiladi. */
  createdAt: string;
  kategoriyalar: number;
  tranzaksiyalar: number;
  xodimlar: number;
  /**
   * OXIRGI FAOLLIK — REAL signal: shu biznesdagi oxirgi yozuv (Transaction)
   * yoki audit jurnalidagi oxirgi amal (sotuv, kassa, CRM, ombor — hammasi
   * extension orqali audit'ga tushadi). Ikkalasi ham yo'q bo'lsa `null` —
   * hech qanday soxta qiymat qo'yilmaydi.
   */
  oxirgiFaollik: string | null;
}

/** Xodim sonini hisoblash uchun kerakli minimal shakl. */
interface XodimQatori {
  businessId: string | null;
  bizneslar: { businessId: string }[];
}

/**
 * "Shu bizneste ishlaydigan xodimlar" — `biznesXodimlariWhere` bilan BIR XIL
 * qoida (lib/services/userBiznes.ts), lekin xotirada: biriktirilmagan xodim
 * (direktor/administrator) barcha bizneslarda hisoblanadi.
 */
function xodimlarniSana(xodimlar: XodimQatori[], biznesIdlar: string[]): Map<string, number> {
  const natija = new Map<string, number>(biznesIdlar.map((id) => [id, 0]));
  let biriktirilmagan = 0;
  for (const x of xodimlar) {
    const idlar = new Set(x.bizneslar.map((b) => b.businessId));
    if (x.businessId) idlar.add(x.businessId);
    if (idlar.size === 0) {
      biriktirilmagan++;
      continue;
    }
    for (const id of idlar) {
      if (natija.has(id)) natija.set(id, (natija.get(id) ?? 0) + 1);
    }
  }
  if (biriktirilmagan > 0) {
    for (const id of biznesIdlar) natija.set(id, (natija.get(id) ?? 0) + biriktirilmagan);
  }
  return natija;
}

/** Ikki sanadan kechrog'i (ikkalasi ham bo'sh bo'lsa null). */
function kechrogi(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Tenantning barcha bizneslari + har biri bo'yicha real ko'rsatkichlar.
 *
 * So'rovlar soni O'ZGARMAS (biznes soniga bog'liq emas): 1 ta biznes +
 * 4 ta guruh/ro'yxat so'rovi.
 */
export async function biznesStatlari(): Promise<BiznesStat[]> {
  const bizneslar = await prisma.business.findMany({
    orderBy: { nomi: "asc" },
    select: {
      id: true,
      nomi: true,
      isActive: true,
      turi: true,
      omborli: true,
      magazin: true,
      shaxsiyKassa: true,
      createdAt: true,
    },
  });
  if (bizneslar.length === 0) return [];

  const idlar = bizneslar.map((b) => b.id);

  const [tranzaksiyalar, kategoriyalar, auditlar, xodimlar] = await Promise.all([
    // Soft-delete qoidasi: o'chirilgan yozuv sanalmaydi.
    prisma.transaction.groupBy({
      by: ["businessId"],
      where: { deletedAt: null },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.category.groupBy({ by: ["businessId"], _count: { _all: true } }),
    prisma.auditLog.groupBy({
      by: ["businessId"],
      where: { businessId: { not: null } },
      _max: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { businessId: true, bizneslar: { select: { businessId: true } } },
    }),
  ]);

  const txMap = new Map(tranzaksiyalar.map((t) => [t.businessId, t]));
  const katMap = new Map(kategoriyalar.map((k) => [k.businessId, k._count._all]));
  const auditMap = new Map(auditlar.map((a) => [a.businessId ?? "", a._max.createdAt]));
  const xodimMap = xodimlarniSana(xodimlar, idlar);

  return bizneslar.map((b) => {
    const tx = txMap.get(b.id);
    const faollik = kechrogi(tx?._max.createdAt ?? null, auditMap.get(b.id) ?? null);
    return {
      id: b.id,
      nomi: b.nomi,
      isActive: b.isActive,
      turi: b.turi,
      omborli: b.omborli,
      magazin: b.magazin,
      shaxsiyKassa: b.shaxsiyKassa,
      createdAt: b.createdAt.toISOString(),
      kategoriyalar: katMap.get(b.id) ?? 0,
      tranzaksiyalar: tx?._count._all ?? 0,
      xodimlar: xodimMap.get(b.id) ?? 0,
      oxirgiFaollik: faollik ? faollik.toISOString() : null,
    };
  });
}
