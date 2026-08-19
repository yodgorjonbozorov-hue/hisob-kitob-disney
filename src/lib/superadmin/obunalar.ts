import { rawPrisma } from "@/lib/db/rawPrisma";
import { planByCode, PLANLAR } from "@/lib/billing/plans";
import { computeAccess } from "@/lib/billing/access";
import { skip, sahifaNatija, type SahifaNatija, type SahifaSorovi } from "./sahifalash";

/**
 * OBUNALAR (talab 18/19).
 *
 * Bu loyihada obuna HOLATI tenant qatorida yashaydi (`status`, `plan`,
 * `trialEndsAt`, `currentPeriodEnd`), `Subscription` esa TO'LANGAN DAVRLAR
 * tarixi. Shuning uchun ro'yxat tenantdan quriladi va unga oxirgi davr
 * biriktiriladi — aks holda sinovdagi (hali to'lamagan) mijozlar ro'yxatga
 * umuman tushmasdi.
 */

export type ObunaHolat = "TRIAL" | "ACTIVE" | "PAST_DUE" | "BLOCKED";

export interface ObunaFiltr {
  qidiruv?: string | null;
  holat?: string | null;
  plan?: string | null;
  /** Muddati shuncha kun ichida tugaydiganlar. */
  tugaydiKun?: number | null;
}

export interface ObunaQator {
  tenantId: string;
  nomi: string;
  plan: string;
  planNomi: string;
  holat: string;
  accessMode: string;
  bepul: boolean;
  boshlanish: Date | null;
  tugash: Date | null;
  kunQoldi: number | null;
  /** Oylik takrorlanuvchi tushum (so'm) — faqat ACTIVE va bepul bo'lmagan. */
  mrr: number;
  /** Oxirgi tasdiqlangan to'lov. */
  oxirgiTolov: Date | null;
  kutilayotganTolov: number;
}

const KUN_MS = 24 * 60 * 60 * 1000;

function whereBoylab(f: ObunaFiltr, now: Date) {
  const AND: Record<string, unknown>[] = [];
  if (f.qidiruv) {
    const q = f.qidiruv.trim();
    AND.push({
      OR: [{ name: { contains: q } }, { name: { contains: q.toLowerCase() } }, { slug: { contains: q.toLowerCase() } }],
    });
  }
  if (f.holat) AND.push({ status: f.holat });
  if (f.plan) AND.push({ plan: f.plan });
  if (f.tugaydiKun != null) {
    const chegara = new Date(now.getTime() + f.tugaydiKun * KUN_MS);
    // TRIAL uchun trialEndsAt, aks holda currentPeriodEnd — ikkalasi ham qaraladi.
    AND.push({
      OR: [
        { AND: [{ status: "TRIAL" }, { trialEndsAt: { lte: chegara, gte: now } }] },
        { AND: [{ status: { not: "TRIAL" } }, { currentPeriodEnd: { lte: chegara, gte: now } }] },
      ],
    });
  }
  return AND.length > 0 ? { AND } : {};
}

export async function obunalarRoyxati(
  filtr: ObunaFiltr,
  sorov: SahifaSorovi,
  now: Date = new Date()
): Promise<SahifaNatija<ObunaQator>> {
  const where = whereBoylab(filtr, now);
  const [jami, tenants] = await Promise.all([
    rawPrisma.tenant.count({ where }),
    rawPrisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: skip(sorov),
      take: sorov.limit,
      select: {
        id: true,
        name: true,
        plan: true,
        status: true,
        bepul: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        createdAt: true,
      },
    }),
  ]);

  const idlar = tenants.map((t) => t.id);
  const [oxirgiDavr, oxirgiTolovlar, kutilayotgan] = await Promise.all([
    idlar.length
      ? rawPrisma.subscription.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: idlar } },
          _max: { periodStart: true },
        })
      : [],
    idlar.length
      ? rawPrisma.payment.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: idlar }, status: "CONFIRMED" },
          _max: { paidAt: true },
        })
      : [],
    idlar.length
      ? rawPrisma.payment.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: idlar }, status: "PENDING" },
          _count: { _all: true },
        })
      : [],
  ]);
  const davrMap = new Map(oxirgiDavr.map((r) => [r.tenantId, r._max.periodStart]));
  const tolovMap = new Map(oxirgiTolovlar.map((r) => [r.tenantId, r._max.paidAt]));
  const kutMap = new Map(kutilayotgan.map((r) => [r.tenantId, r._count._all]));

  const qatorlar: ObunaQator[] = tenants.map((t) => {
    const access = computeAccess(t, now);
    const tugash = t.status === "TRIAL" ? t.trialEndsAt : t.currentPeriodEnd;
    return {
      tenantId: t.id,
      nomi: t.name,
      plan: t.plan,
      planNomi: planByCode(t.plan)?.nomi ?? t.plan,
      holat: t.status,
      accessMode: access.mode,
      bepul: t.bepul,
      boshlanish: davrMap.get(t.id) ?? t.createdAt,
      tugash,
      kunQoldi: access.kunQoldi,
      mrr: t.status === "ACTIVE" && !t.bepul ? (planByCode(t.plan)?.oylikNarx ?? 0) : 0,
      oxirgiTolov: tolovMap.get(t.id) ?? null,
      kutilayotganTolov: kutMap.get(t.id) ?? 0,
    };
  });

  return sahifaNatija(qatorlar, jami, sorov);
}

export interface TarifQamrovi {
  code: string;
  nomi: string;
  oylikNarx: number;
  modullar: string[];
  /** Shu tarifdagi kompaniyalar soni. */
  soni: number;
  /** Shu tarifdan keladigan MRR. */
  mrr: number;
}

/** Tariflar sahifasi: har tarif bo'yicha mijoz soni va MRR (talab 19). */
export async function tariflarQamrovi(): Promise<TarifQamrovi[]> {
  const [jami, faol] = await Promise.all([
    rawPrisma.tenant.groupBy({ by: ["plan"], _count: { _all: true } }),
    rawPrisma.tenant.groupBy({
      by: ["plan"],
      where: { status: "ACTIVE", bepul: false },
      _count: { _all: true },
    }),
  ]);
  const jamiMap = new Map(jami.map((r) => [r.plan, r._count._all]));
  const faolMap = new Map(faol.map((r) => [r.plan, r._count._all]));

  return PLANLAR.map((p) => ({
    code: p.code,
    nomi: p.nomi,
    oylikNarx: p.oylikNarx,
    modullar: p.modullar,
    soni: jamiMap.get(p.code) ?? 0,
    mrr: (faolMap.get(p.code) ?? 0) * p.oylikNarx,
  }));
}

/** Kompaniyaning obuna davrlari tarixi (Business detail → SUBSCRIPTION). */
export async function obunaTarixi(tenantId: string) {
  return rawPrisma.subscription.findMany({
    where: { tenantId },
    orderBy: { periodStart: "desc" },
    take: 50,
    select: {
      id: true,
      plan: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      amount: true,
      createdAt: true,
    },
  });
}
