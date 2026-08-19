import { rawPrisma } from "@/lib/db/rawPrisma";
import { planByCode } from "@/lib/billing/plans";
import { tizimSoglik, type SoglikHolat } from "./tizim";
import { modulQamrovi, type ModulQamrovi } from "./modullar";
import { amalLabel } from "./audit";

/**
 * OVERVIEW DASHBOARD (talab 4-7, 60).
 *
 * Maqsad: 10 ta savolga 5 soniyada javob berish. Shuning uchun bu yerda
 * "chiroyli grafik" emas, QAROR QABUL QILINADIGAN raqamlar va HARAKAT
 * TALAB QILADIGAN ogohlantirishlar bor.
 *
 * BARCHA raqamlar bazadan keladi — soxta ma'lumot yo'q.
 */

const KUN_MS = 24 * 60 * 60 * 1000;

export type DavrKalit = "bugun" | "7kun" | "30kun" | "90kun";

export const DAVRLAR: { kalit: DavrKalit; label: string; kun: number }[] = [
  { kalit: "bugun", label: "Bugun", kun: 1 },
  { kalit: "7kun", label: "7 kun", kun: 7 },
  { kalit: "30kun", label: "30 kun", kun: 30 },
  { kalit: "90kun", label: "90 kun", kun: 90 },
];

export interface Davr {
  boshlanish: Date;
  tugash: Date;
  kun: number;
  label: string;
}

/** Davr oralig'i. `custom` uchun sanalar to'g'ridan-to'g'ri beriladi. */
export function davrniHisobla(
  kalit: DavrKalit | "custom",
  now: Date = new Date(),
  custom?: { dan: Date; gacha: Date }
): Davr {
  if (kalit === "custom" && custom) {
    const kun = Math.max(1, Math.ceil((custom.gacha.getTime() - custom.dan.getTime()) / KUN_MS));
    return { boshlanish: custom.dan, tugash: custom.gacha, kun, label: "Tanlangan oraliq" };
  }
  const d = DAVRLAR.find((x) => x.kalit === kalit) ?? DAVRLAR[2];
  return {
    boshlanish: new Date(now.getTime() - d.kun * KUN_MS),
    tugash: now,
    kun: d.kun,
    label: d.label,
  };
}

export interface DashboardKpi {
  jamiBiznes: number;
  faolBiznes: number;
  yangiBiznes: number;
  sinovdagi: number;
  pullikBiznes: number;
  bloklangan: number;
  jamiFoydalanuvchi: number;
  faolFoydalanuvchi: number;
  mrr: number;
  davrTushum: number;
  /** Davr ichida muddati tugab, yangilanmagan mijozlar soni. */
  churn: number;
  /** Churn foizi: churn / (davr boshidagi pullik mijozlar). null — baza nol. */
  churnFoiz: number | null;
  tizimSoglik: SoglikHolat;
}

export type OgohDaraja = "KRITIK" | "OGOHLANTIRISH" | "MALUMOT";

export interface Ogohlantirish {
  daraja: OgohDaraja;
  sarlavha: string;
  matn: string;
  /** Bosilganda ochiladigan sahifa. */
  href: string;
  soni?: number;
}

export interface FaoliyatQator {
  id: string;
  kim: string | null;
  amal: string;
  amalLabel: string;
  entity: string;
  entityId: string;
  sabab: string | null;
  createdAt: Date;
}

export interface OsishNuqta {
  sana: string;
  qiymat: number;
}

export interface DashboardMalumot {
  davr: Davr;
  kpi: DashboardKpi;
  ogohlantirishlar: Ogohlantirish[];
  faoliyat: FaoliyatQator[];
  biznesOsishi: OsishNuqta[];
  foydalanuvchiOsishi: OsishNuqta[];
  tushumOsishi: OsishNuqta[];
  modulQamrovi: ModulQamrovi[];
}

/** Sanalar bo'yicha kunlik qatorga aylantirish (dialektga bog'liq SQL'siz). */
function kunlarBoyicha(sanalar: { sana: Date; qiymat: number }[], davr: Davr): OsishNuqta[] {
  const bucket = new Map<string, number>();
  const kunSoni = Math.min(davr.kun, 90);
  for (let i = kunSoni - 1; i >= 0; i--) {
    const d = new Date(davr.tugash.getTime() - i * KUN_MS);
    bucket.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of sanalar) {
    const kalit = s.sana.toISOString().slice(0, 10);
    if (bucket.has(kalit)) bucket.set(kalit, (bucket.get(kalit) ?? 0) + s.qiymat);
  }
  return [...bucket.entries()].map(([sana, qiymat]) => ({ sana, qiymat }));
}

export async function dashboardMalumot(
  davr: Davr,
  now: Date = new Date()
): Promise<DashboardMalumot> {
  const [
    tenantHolatlar,
    yangiTenantlar,
    jamiFoydalanuvchi,
    faolFoydalanuvchi,
    yangiUserlar,
    davrTolovlar,
    faolTariflar,
    churnlar,
    pullikJami,
    kutilayotgan,
    tugayotganSinov,
    muddatiOtgan,
    muvaffaqiyatsizKirish,
    ochiqTiket,
    faoliyat,
    soglik,
    qamrov,
  ] = await Promise.all([
    rawPrisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
    rawPrisma.tenant.findMany({
      where: { createdAt: { gte: davr.boshlanish, lte: davr.tugash } },
      select: { createdAt: true },
    }),
    rawPrisma.user.count({ where: { tenantId: { not: null } } }),
    rawPrisma.user.count({
      where: { tenantId: { not: null }, lastLoginAt: { gte: davr.boshlanish } },
    }),
    rawPrisma.user.findMany({
      where: { tenantId: { not: null }, createdAt: { gte: davr.boshlanish, lte: davr.tugash } },
      select: { createdAt: true },
    }),
    rawPrisma.payment.findMany({
      where: { status: "CONFIRMED", createdAt: { gte: davr.boshlanish, lte: davr.tugash } },
      select: { createdAt: true, amount: true },
    }),
    rawPrisma.tenant.groupBy({
      by: ["plan"],
      where: { status: "ACTIVE", bepul: false },
      _count: { _all: true },
    }),
    // Churn: davr ichida obuna muddati tugagan va hozir to'lamayotgan mijozlar.
    rawPrisma.tenant.count({
      where: {
        bepul: false,
        status: { in: ["PAST_DUE", "BLOCKED"] },
        currentPeriodEnd: { gte: davr.boshlanish, lte: davr.tugash },
      },
    }),
    rawPrisma.tenant.count({ where: { bepul: false, status: { in: ["ACTIVE", "PAST_DUE"] } } }),
    rawPrisma.payment.aggregate({ where: { status: "PENDING" }, _count: true, _sum: { amount: true } }),
    rawPrisma.tenant.count({
      where: {
        status: "TRIAL",
        trialEndsAt: { gte: now, lte: new Date(now.getTime() + 3 * KUN_MS) },
      },
    }),
    rawPrisma.tenant.count({ where: { status: "PAST_DUE", bepul: false } }),
    rawPrisma.auditLog.count({
      where: { action: "login_failed", createdAt: { gte: new Date(now.getTime() - KUN_MS) } },
    }),
    rawPrisma.supportTicket.count({ where: { holat: { in: ["OCHIQ", "KUTILMOQDA"] } } }),
    rawPrisma.auditLog.findMany({
      where: { userIsm: { startsWith: "[SUPERADMIN" } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        userIsm: true,
        action: true,
        entity: true,
        entityId: true,
        sabab: true,
        createdAt: true,
      },
    }),
    tizimSoglik(now),
    modulQamrovi(),
  ]);

  const holatMap = new Map(tenantHolatlar.map((r) => [r.status, r._count._all]));
  const jamiBiznes = tenantHolatlar.reduce((a, r) => a + r._count._all, 0);
  const bloklangan = holatMap.get("BLOCKED") ?? 0;
  const sinovdagi = holatMap.get("TRIAL") ?? 0;
  const pullikBiznes = holatMap.get("ACTIVE") ?? 0;

  const mrr = faolTariflar.reduce(
    (a, t) => a + (planByCode(t.plan)?.oylikNarx ?? 0) * t._count._all,
    0
  );
  const davrTushum = davrTolovlar.reduce((a, p) => a + p.amount, 0);

  const ogohlantirishlar: Ogohlantirish[] = [];
  if (soglik.umumiy !== "SOG'LOM") {
    const yomon = soglik.komponentlar.filter(
      (k) => k.holat === "KRITIK" || k.holat === "OGOHLANTIRISH"
    );
    ogohlantirishlar.push({
      daraja: soglik.umumiy === "KRITIK" ? "KRITIK" : "OGOHLANTIRISH",
      sarlavha: "Tizim komponentlari e'tibor talab qiladi",
      matn: yomon.map((k) => `${k.nomi}: ${k.izoh}`).join(" · "),
      href: "/superadmin/tizim",
      soni: yomon.length,
    });
  }
  if (kutilayotgan._count > 0) {
    ogohlantirishlar.push({
      daraja: "OGOHLANTIRISH",
      sarlavha: "Tasdiq kutayotgan to'lovlar",
      matn: `${kutilayotgan._count} ta to'lov qaror kutmoqda.`,
      href: "/superadmin/billing?status=PENDING",
      soni: kutilayotgan._count,
    });
  }
  if (muddatiOtgan > 0) {
    ogohlantirishlar.push({
      daraja: "OGOHLANTIRISH",
      sarlavha: "Muddati o'tgan obunalar",
      matn: `${muddatiOtgan} ta mijoz faqat o'qish rejimida — to'lov kutilmoqda.`,
      href: "/superadmin/obunalar?holat=PAST_DUE",
      soni: muddatiOtgan,
    });
  }
  if (tugayotganSinov > 0) {
    ogohlantirishlar.push({
      daraja: "MALUMOT",
      sarlavha: "Sinov muddati tugayapti",
      matn: `${tugayotganSinov} ta mijozning sinov muddati 3 kun ichida tugaydi.`,
      href: "/superadmin/obunalar?tugaydiKun=3",
      soni: tugayotganSinov,
    });
  }
  if (bloklangan > 0) {
    ogohlantirishlar.push({
      daraja: "MALUMOT",
      sarlavha: "Bloklangan mijozlar",
      matn: `${bloklangan} ta mijoz bloklangan holatda.`,
      href: "/superadmin/bizneslar?status=BLOCKED",
      soni: bloklangan,
    });
  }
  if (muvaffaqiyatsizKirish >= 10) {
    ogohlantirishlar.push({
      daraja: "KRITIK",
      sarlavha: "Ko'p muvaffaqiyatsiz kirish urinishi",
      matn: `Oxirgi 24 soatda ${muvaffaqiyatsizKirish} ta muvaffaqiyatsiz kirish urinishi qayd etildi.`,
      href: "/superadmin/xavfsizlik",
      soni: muvaffaqiyatsizKirish,
    });
  }
  if (ochiqTiket > 0) {
    ogohlantirishlar.push({
      daraja: "MALUMOT",
      sarlavha: "Ochiq support tiketlari",
      matn: `${ochiqTiket} ta tiket javob kutmoqda.`,
      href: "/superadmin/support",
      soni: ochiqTiket,
    });
  }

  return {
    davr,
    kpi: {
      jamiBiznes,
      faolBiznes: jamiBiznes - bloklangan,
      yangiBiznes: yangiTenantlar.length,
      sinovdagi,
      pullikBiznes,
      bloklangan,
      jamiFoydalanuvchi,
      faolFoydalanuvchi,
      mrr,
      davrTushum,
      churn: churnlar,
      churnFoiz: pullikJami > 0 ? Math.round((churnlar / pullikJami) * 1000) / 10 : null,
      tizimSoglik: soglik.umumiy,
    },
    ogohlantirishlar,
    faoliyat: faoliyat.map((a) => ({
      id: a.id,
      kim: a.userIsm,
      amal: a.action,
      amalLabel: amalLabel(a.action),
      entity: a.entity,
      entityId: a.entityId,
      sabab: a.sabab,
      createdAt: a.createdAt,
    })),
    biznesOsishi: kunlarBoyicha(
      yangiTenantlar.map((t) => ({ sana: t.createdAt, qiymat: 1 })),
      davr
    ),
    foydalanuvchiOsishi: kunlarBoyicha(
      yangiUserlar.map((u) => ({ sana: u.createdAt, qiymat: 1 })),
      davr
    ),
    tushumOsishi: kunlarBoyicha(
      davrTolovlar.map((p) => ({ sana: p.createdAt, qiymat: p.amount })),
      davr
    ),
    modulQamrovi: qamrov,
  };
}
