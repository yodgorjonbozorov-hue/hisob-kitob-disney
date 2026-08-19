import { rawPrisma } from "@/lib/db/rawPrisma";
import { planByCode } from "@/lib/billing/plans";
import { skip, sahifaNatija, type SahifaNatija, type SahifaSorovi } from "./sahifalash";

/**
 * BILLING (talab 20) — to'lovlar, tushum, muammoli to'lovlar.
 *
 * Pul HAR DOIM `Int` (so'm) — hech qanday float hisob yo'q.
 * Bu loyihada alohida "invoice" jadvali yo'q: hisob-faktura rolini `Payment`
 * yozuvi bajaradi (provider + externalId + status). Shuning uchun soxta
 * "Invoices" bo'limi YARATILMAYDI — to'lov yozuvi to'liq tafsilot beradi.
 */

export interface TolovFiltr {
  qidiruv?: string | null;
  status?: string | null;
  provider?: string | null;
  tenantId?: string | null;
  sanadan?: Date | null;
  sanagacha?: Date | null;
}

export interface TolovQator {
  id: string;
  tenantId: string;
  tenantNomi: string;
  amount: number;
  provider: string;
  status: string;
  plan: string | null;
  izoh: string | null;
  externalId: string | null;
  providerState: number | null;
  paidAt: Date | null;
  cancelTime: Date | null;
  createdAt: Date;
}

function whereBoylab(f: TolovFiltr) {
  const AND: Record<string, unknown>[] = [];
  if (f.status) AND.push({ status: f.status });
  if (f.provider) AND.push({ provider: f.provider });
  if (f.tenantId) AND.push({ tenantId: f.tenantId });
  if (f.sanadan) AND.push({ createdAt: { gte: f.sanadan } });
  if (f.sanagacha) AND.push({ createdAt: { lte: f.sanagacha } });
  if (f.qidiruv) {
    const q = f.qidiruv.trim();
    AND.push({
      OR: [
        { id: q },
        { externalId: q },
        { tenant: { name: { contains: q } } },
        { tenant: { name: { contains: q.toLowerCase() } } },
      ],
    });
  }
  return AND.length > 0 ? { AND } : {};
}

export async function tolovlarRoyxati(
  filtr: TolovFiltr,
  sorov: SahifaSorovi
): Promise<SahifaNatija<TolovQator>> {
  const where = whereBoylab(filtr);
  const [jami, rows] = await Promise.all([
    rawPrisma.payment.count({ where }),
    rawPrisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: skip(sorov),
      take: sorov.limit,
      select: {
        id: true,
        tenantId: true,
        amount: true,
        provider: true,
        status: true,
        plan: true,
        izoh: true,
        externalId: true,
        providerState: true,
        paidAt: true,
        cancelTime: true,
        createdAt: true,
        tenant: { select: { name: true } },
      },
    }),
  ]);

  const qatorlar: TolovQator[] = rows.map((p) => ({
    id: p.id,
    tenantId: p.tenantId,
    tenantNomi: p.tenant.name,
    amount: p.amount,
    provider: p.provider,
    status: p.status,
    plan: p.plan,
    izoh: p.izoh,
    externalId: p.externalId,
    providerState: p.providerState,
    paidAt: p.paidAt,
    cancelTime: p.cancelTime,
    createdAt: p.createdAt,
  }));

  return sahifaNatija(qatorlar, jami, sorov);
}

export interface BillingXulosa {
  /** Butun tarix bo'yicha tasdiqlangan tushum (so'm). */
  jamiTushum: number;
  /** Joriy oy tushumi. */
  buOyTushum: number;
  /** O'tgan oy tushumi — o'sish foizini hisoblash uchun. */
  otganOyTushum: number;
  /** Oylik takrorlanuvchi tushum: faol, bepul bo'lmagan obunalar tarifi yig'indisi. */
  mrr: number;
  kutilayotganSoni: number;
  kutilayotganSumma: number;
  radEtilganSoni: number;
  /** Provayder kesimi (MANUAL/PAYME/CLICK). */
  provayderlar: { provider: string; soni: number; summa: number }[];
}

function oyBoshi(d: Date, siljish = 0): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + siljish, 1));
}

export async function billingXulosa(now: Date = new Date()): Promise<BillingXulosa> {
  const buOy = oyBoshi(now);
  const otganOy = oyBoshi(now, -1);

  const [jami, buOyAgg, otganOyAgg, kutilayotgan, radEtilgan, provayderlar, faolTenantlar] =
    await Promise.all([
      rawPrisma.payment.aggregate({ where: { status: "CONFIRMED" }, _sum: { amount: true } }),
      rawPrisma.payment.aggregate({
        where: { status: "CONFIRMED", createdAt: { gte: buOy } },
        _sum: { amount: true },
      }),
      rawPrisma.payment.aggregate({
        where: { status: "CONFIRMED", createdAt: { gte: otganOy, lt: buOy } },
        _sum: { amount: true },
      }),
      rawPrisma.payment.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      rawPrisma.payment.count({ where: { status: "REJECTED" } }),
      rawPrisma.payment.groupBy({
        by: ["provider"],
        where: { status: "CONFIRMED" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      rawPrisma.tenant.groupBy({
        by: ["plan"],
        where: { status: "ACTIVE", bepul: false },
        _count: { _all: true },
      }),
    ]);

  const mrr = faolTenantlar.reduce(
    (acc, t) => acc + (planByCode(t.plan)?.oylikNarx ?? 0) * t._count._all,
    0
  );

  return {
    jamiTushum: jami._sum.amount ?? 0,
    buOyTushum: buOyAgg._sum.amount ?? 0,
    otganOyTushum: otganOyAgg._sum.amount ?? 0,
    mrr,
    kutilayotganSoni: kutilayotgan._count,
    kutilayotganSumma: kutilayotgan._sum.amount ?? 0,
    radEtilganSoni: radEtilgan,
    provayderlar: provayderlar.map((p) => ({
      provider: p.provider,
      soni: p._count._all,
      summa: p._sum.amount ?? 0,
    })),
  };
}

/** Bitta to'lov kartochkasi (Billing → payment detail). */
export async function tolovTafsiloti(paymentId: string) {
  return rawPrisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      tenantId: true,
      amount: true,
      provider: true,
      status: true,
      plan: true,
      izoh: true,
      externalId: true,
      providerState: true,
      providerCreatedAt: true,
      cancelTime: true,
      cancelReason: true,
      paidAt: true,
      createdAt: true,
      tenant: { select: { name: true, slug: true, plan: true, status: true } },
    },
  });
}
