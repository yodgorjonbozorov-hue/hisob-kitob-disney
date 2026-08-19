import { rawPrisma } from "@/lib/db/rawPrisma";
import { computeAccess } from "@/lib/billing/access";
import { planByCode } from "@/lib/billing/plans";
import { skip, sahifaNatija, type SahifaNatija, type SahifaSorovi } from "./sahifalash";

/**
 * BIZNESLAR (mijoz kompaniyalar) — Control Center'ning tenant boshqaruvi.
 *
 * Barcha filtr/saralash/sahifalash BAZADA bajariladi: 100 000 kompaniya
 * bo'lganda ham brauzerga bitta sahifa (25 qator) yuboriladi. Ilgari panel
 * BARCHA tenantni bitta so'rovda o'qirdi va ularning har birining
 * foydalanuvchilarini ham yuklardi.
 *
 * `rawPrisma` ATAYLAB — bu tizim darajasidagi, tenantlar aro amal
 * (CLAUDE.md dagi ruxsat etilgan istisno: `src/lib/superadmin/`).
 */

export type BiznesSaralash = "yangi" | "eski" | "nom" | "faollik" | "tushum";

export interface BiznesFiltr {
  qidiruv?: string | null;
  /** "TRIAL" | "ACTIVE" | "PAST_DUE" | "BLOCKED" */
  status?: string | null;
  plan?: string | null;
  /** Faqat shu modul yoqilgan kompaniyalar. */
  modul?: string | null;
  /** Doimiy bepul mijozlar. */
  bepul?: boolean | null;
  /** Ro'yxatdan o'tgan sana oralig'i (ISO). */
  sanadan?: Date | null;
  sanagacha?: Date | null;
  saralash?: BiznesSaralash;
}

export interface BiznesQator {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  bepul: boolean;
  accessMode: string;
  createdAt: Date;
  deadline: Date | null;
  userCount: number;
  businessCount: number;
  modulSoni: number;
  lastActivity: Date | null;
  pendingPayments: number;
  /** Tasdiqlangan to'lovlar yig'indisi (so'm) — kompaniya keltirgan tushum. */
  tushum: number;
}

/** Prisma `where` bo'lagi — ro'yxat va eksport bitta manbadan foydalanadi. */
function whereBoylab(f: BiznesFiltr) {
  const AND: Record<string, unknown>[] = [];
  if (f.qidiruv) {
    const q = f.qidiruv.trim();
    // SQLite'da `contains` registrga sezgir; slug har doim kichik harfda
    // saqlanadi, shuning uchun ikkala variant ham qidiriladi.
    AND.push({
      OR: [
        { name: { contains: q } },
        { name: { contains: q.toLowerCase() } },
        { slug: { contains: q.toLowerCase() } },
        { id: q },
      ],
    });
  }
  if (f.status) AND.push({ status: f.status });
  if (f.plan) AND.push({ plan: f.plan });
  if (f.bepul != null) AND.push({ bepul: f.bepul });
  if (f.modul) AND.push({ modules: { some: { code: f.modul, isActive: true } } });
  if (f.sanadan) AND.push({ createdAt: { gte: f.sanadan } });
  if (f.sanagacha) AND.push({ createdAt: { lte: f.sanagacha } });
  return AND.length > 0 ? { AND } : {};
}

function orderByBoylab(saralash: BiznesSaralash | undefined) {
  switch (saralash) {
    case "eski":
      return { createdAt: "asc" as const };
    case "nom":
      return { name: "asc" as const };
    default:
      return { createdAt: "desc" as const };
  }
}

/**
 * Kompaniyalar sahifasi.
 *
 * "faollik" va "tushum" bo'yicha saralash BAZADA bajarilmaydi (ular tenant
 * jadvalida ustun emas), shuning uchun ular joriy SAHIFA ichida saralanadi va
 * bu chaqiruvchiga ochiq aytiladi (`sahifaIchidaSaralandi`).
 */
export async function bizneslarRoyxati(
  filtr: BiznesFiltr,
  sorov: SahifaSorovi
): Promise<SahifaNatija<BiznesQator> & { sahifaIchidaSaralandi: boolean }> {
  const where = whereBoylab(filtr);

  const [jami, tenants] = await Promise.all([
    rawPrisma.tenant.count({ where }),
    rawPrisma.tenant.findMany({
      where,
      orderBy: orderByBoylab(filtr.saralash),
      skip: skip(sorov),
      take: sorov.limit,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
        bepul: true,
        createdAt: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        _count: { select: { users: true, businesses: true } },
      },
    }),
  ]);

  const idlar = tenants.map((t) => t.id);
  const [oxirgiKirish, kutilayotgan, tushumlar, modullar] = await Promise.all([
    idlar.length
      ? rawPrisma.user.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: idlar } },
          _max: { lastLoginAt: true },
        })
      : [],
    idlar.length
      ? rawPrisma.payment.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: idlar }, status: "PENDING" },
          _count: { _all: true },
        })
      : [],
    idlar.length
      ? rawPrisma.payment.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: idlar }, status: "CONFIRMED" },
          _sum: { amount: true },
        })
      : [],
    idlar.length
      ? rawPrisma.tenantModule.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: idlar }, isActive: true },
          _count: { _all: true },
        })
      : [],
  ]);

  const kirishMap = new Map(oxirgiKirish.map((r) => [r.tenantId, r._max.lastLoginAt]));
  const kutMap = new Map(kutilayotgan.map((r) => [r.tenantId, r._count._all]));
  const tushumMap = new Map(tushumlar.map((r) => [r.tenantId, r._sum.amount ?? 0]));
  const modulMap = new Map(modullar.map((r) => [r.tenantId, r._count._all]));

  let qatorlar: BiznesQator[] = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    plan: t.plan,
    bepul: t.bepul,
    accessMode: computeAccess(t).mode,
    createdAt: t.createdAt,
    deadline: t.status === "TRIAL" ? t.trialEndsAt : t.currentPeriodEnd,
    userCount: t._count.users,
    businessCount: t._count.businesses,
    modulSoni: modulMap.get(t.id) ?? 0,
    lastActivity: kirishMap.get(t.id) ?? null,
    pendingPayments: kutMap.get(t.id) ?? 0,
    tushum: tushumMap.get(t.id) ?? 0,
  }));

  let sahifaIchidaSaralandi = false;
  if (filtr.saralash === "faollik") {
    qatorlar = [...qatorlar].sort(
      (a, b) => (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0)
    );
    sahifaIchidaSaralandi = true;
  } else if (filtr.saralash === "tushum") {
    qatorlar = [...qatorlar].sort((a, b) => b.tushum - a.tushum);
    sahifaIchidaSaralandi = true;
  }

  return { ...sahifaNatija(qatorlar, jami, sorov), sahifaIchidaSaralandi };
}

export interface BiznesTafsiloti {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  planNomi: string;
  bepul: boolean;
  accessMode: string;
  accessSabab: string | null;
  kunQoldi: number | null;
  createdAt: Date;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  egasi: { id: string; ism: string; login: string; telegram: boolean } | null;
  /** Ko'rsatkichlar (talab 10). */
  jamiUser: number;
  faolUser: number;
  bizneslar: { id: string; nomi: string; turi: string; omborli: boolean; isActive: boolean }[];
  tranzaksiyaSoni: number;
  mahsulotSoni: number;
  mijozSoni: number;
  tushum: number;
  oxirgiFaollik: Date | null;
}

/** Bitta kompaniyaning to'liq kartochkasi (Business detail → OVERVIEW). */
export async function biznesTafsiloti(tenantId: string): Promise<BiznesTafsiloti | null> {
  const t = await rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      plan: true,
      bepul: true,
      createdAt: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
    },
  });
  if (!t) return null;

  const bizneslar = await rawPrisma.business.findMany({
    where: { tenantId },
    select: { id: true, nomi: true, turi: true, omborli: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const businessIds = bizneslar.map((b) => b.id);

  const [egasi, jamiUser, faolUser, oxirgi, tushum, tranzaksiyaSoni, mahsulotSoni, mijozSoni] =
    await Promise.all([
      rawPrisma.user.findFirst({
        where: { tenantId, rol: "OWNER" },
        orderBy: { createdAt: "asc" },
        select: { id: true, ism: true, login: true, telegramChatId: true },
      }),
      rawPrisma.user.count({ where: { tenantId } }),
      rawPrisma.user.count({ where: { tenantId, isActive: true } }),
      rawPrisma.user.aggregate({ where: { tenantId }, _max: { lastLoginAt: true } }),
      rawPrisma.payment.aggregate({
        where: { tenantId, status: "CONFIRMED" },
        _sum: { amount: true },
      }),
      businessIds.length
        ? rawPrisma.transaction.count({ where: { businessId: { in: businessIds }, deletedAt: null } })
        : 0,
      // Product'da soft-delete yo'q (sxemada `deletedAt` ustuni yo'q).
      businessIds.length ? rawPrisma.product.count({ where: { businessId: { in: businessIds } } }) : 0,
      businessIds.length ? rawPrisma.contact.count({ where: { businessId: { in: businessIds } } }) : 0,
    ]);

  const access = computeAccess(t);
  return {
    ...t,
    planNomi: planByCode(t.plan)?.nomi ?? t.plan,
    accessMode: access.mode,
    accessSabab: access.sabab,
    kunQoldi: access.kunQoldi,
    egasi: egasi
      ? { id: egasi.id, ism: egasi.ism, login: egasi.login, telegram: !!egasi.telegramChatId }
      : null,
    jamiUser,
    faolUser,
    bizneslar,
    tranzaksiyaSoni,
    mahsulotSoni,
    mijozSoni,
    tushum: tushum._sum.amount ?? 0,
    oxirgiFaollik: oxirgi._max.lastLoginAt ?? null,
  };
}
