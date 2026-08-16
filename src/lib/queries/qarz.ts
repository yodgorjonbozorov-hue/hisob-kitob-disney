import { prisma } from "@/lib/prisma";
import { qidiruvRejimi } from "@/lib/db/dialect";
import { dateOnlyStringToUTCDate, todayDateOnlyString } from "@/lib/date";
import { qarzHolatHisobla, type QarzHolat } from "@/lib/validation/qarz";
import type { Prisma } from "@prisma/client";

/**
 * Qarz ro'yxati va tafsiloti uchun so'rovlar.
 *
 * Eski `listDebts` (lib/queries/inventory.ts) faqat ombor sahifasi uchun
 * yetarli edi: holatsiz, to'lovsiz, filtrsiz. Qarzlar endi alohida modul
 * bo'lgani uchun so'rovlar ham shu yerga ajratildi.
 */

export interface QarzDTO {
  id: string;
  /** "olinadigan" — bizga qarzdor; "beriladigan" — biz qarzdormiz. */
  turi: string;
  status: QarzHolat;
  mijozNomi: string;
  mijozTel: string | null;
  contactId: string | null;
  jamiSumma: number;
  tolangan: number;
  qolgan: number;
  isYopilgan: boolean;
  /** Qarz berilgan sana (ISO). Eski yozuvlarda `createdAt` dan olinadi. */
  sana: string;
  muddat: string | null;
  /** Oxirgi to'lov sanasi (ISO) — to'lov bo'lmasa null. */
  oxirgiTolov: string | null;
  izoh: string | null;
  masulIsm: string | null;
  kategoriyaNomi: string | null;
  productNomi: string | null;
  /** Muddat belgilangan va o'tib ketgan, qarz esa hali ochiq. */
  muddatOtdi: boolean;
}

export interface QarzFiltr {
  turi?: string | null;
  status?: string | null;
  q?: string | null;
  /** Faqat muddati o'tganlar. */
  muddatOtgan?: boolean;
}

function qarzWhere(businessId: string, filtr: QarzFiltr): Prisma.DebtWhereInput {
  const where: Prisma.DebtWhereInput = { businessId };
  if (filtr.turi === "olinadigan" || filtr.turi === "beriladigan") where.turi = filtr.turi;
  if (filtr.status && filtr.status !== "HAMMASI") where.status = filtr.status;
  if (filtr.muddatOtgan) {
    where.isYopilgan = false;
    where.muddat = { lt: dateOnlyStringToUTCDate(todayDateOnlyString()) };
  }
  if (filtr.q) {
    const rejim = qidiruvRejimi();
    where.OR = [
      { mijozNomi: { contains: filtr.q, ...rejim } },
      { mijozTel: { contains: filtr.q, ...rejim } },
      { izoh: { contains: filtr.q, ...rejim } },
    ];
  }
  return where;
}

/**
 * Eski yozuvlarda `status` va `sana` bo'lmasligi mumkin emas (migratsiya
 * to'ldirgan), lekin migratsiyadan keyin yozilgan xom SQL yoki tiklangan
 * zaxira bo'shatib qo'yishi mumkin — shuning uchun o'qishda ham hisoblanadi.
 */
function holatniOqi(d: { jamiSumma: number; tolangan: number; status: string }): QarzHolat {
  const s = d.status as QarzHolat;
  if (s === "CANCELLED" || s === "PAID" || s === "PARTIALLY_PAID" || s === "OPEN") return s;
  return qarzHolatHisobla(d.jamiSumma, d.tolangan);
}

export async function listQarzlar(businessId: string, filtr: QarzFiltr = {}): Promise<QarzDTO[]> {
  const debts = await prisma.debt.findMany({
    where: qarzWhere(businessId, filtr),
    include: {
      product: { select: { nomi: true, avtoRaqam: true } },
      category: { select: { nomi: true } },
      // Oxirgi to'lov sanasi jadvalda ustun sifatida ko'rsatiladi.
      payments: {
        orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { sana: true, createdAt: true },
      },
    },
    orderBy: [{ isYopilgan: "asc" }, { sana: "desc" }, { createdAt: "desc" }],
    take: 1000,
  });

  const bugun = dateOnlyStringToUTCDate(todayDateOnlyString()).getTime();
  return debts.map((d) => {
    const oxirgi = d.payments[0];
    return {
      id: d.id,
      turi: d.turi,
      status: holatniOqi(d),
      mijozNomi: d.mijozNomi,
      mijozTel: d.mijozTel,
      contactId: d.contactId,
      jamiSumma: d.jamiSumma,
      tolangan: d.tolangan,
      qolgan: d.jamiSumma - d.tolangan,
      isYopilgan: d.isYopilgan,
      sana: (d.sana ?? d.createdAt).toISOString(),
      muddat: d.muddat ? d.muddat.toISOString() : null,
      oxirgiTolov: oxirgi ? (oxirgi.sana ?? oxirgi.createdAt).toISOString() : null,
      izoh: d.izoh,
      masulIsm: d.masulIsm,
      kategoriyaNomi: d.category?.nomi ?? null,
      productNomi: d.product
        ? [d.product.nomi, d.product.avtoRaqam].filter(Boolean).join(" · ")
        : null,
      muddatOtdi: !d.isYopilgan && d.muddat !== null && d.muddat.getTime() < bugun,
    };
  });
}

// ---------------------------------------------------------------------------
// Tafsilot
// ---------------------------------------------------------------------------

export interface QarzTolovDTO {
  id: string;
  summa: number;
  sana: string;
  tolovTuri: string | null;
  kassaNomi: string | null;
  izoh: string | null;
  /** Kim to'lovni qabul qildi. */
  userIsm: string | null;
  transactionId: string | null;
  createdAt: string;
}

export interface QarzTafsilotDTO extends QarzDTO {
  tolovlar: QarzTolovDTO[];
  /** Audit: kim yaratdi, qachon; bekor qilingan bo'lsa — kim va nega. */
  yaratgan: string | null;
  createdAt: string;
  updatedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export async function getQarzTafsilot(
  businessId: string,
  debtId: string
): Promise<QarzTafsilotDTO | null> {
  const d = await prisma.debt.findFirst({
    where: { id: debtId, businessId },
    include: {
      product: { select: { nomi: true, avtoRaqam: true } },
      category: { select: { nomi: true } },
      payments: { orderBy: [{ sana: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!d) return null;

  // To'lovni kim qabul qilgani va qaysi kassaga tushgani — ikkita kichik
  // so'rov bilan (`DebtPayment` da FK yo'q: yozuv tarixi user/kassa
  // o'chirilsa ham o'qiladigan qolishi kerak).
  const userIds = [...new Set([d.userId, ...d.payments.map((p) => p.userId)])];
  const accountIds = [...new Set(d.payments.map((p) => p.accountId).filter(Boolean))] as string[];
  const [users, kassalar] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, ism: true } }),
    accountIds.length
      ? prisma.account.findMany({
          where: { id: { in: accountIds }, businessId },
          select: { id: true, nomi: true },
        })
      : Promise.resolve([]),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u.ism]));
  const kassaMap = new Map(kassalar.map((k) => [k.id, k.nomi]));

  const bugun = dateOnlyStringToUTCDate(todayDateOnlyString()).getTime();
  const oxirgi = d.payments[d.payments.length - 1];

  return {
    id: d.id,
    turi: d.turi,
    status: holatniOqi(d),
    mijozNomi: d.mijozNomi,
    mijozTel: d.mijozTel,
    contactId: d.contactId,
    jamiSumma: d.jamiSumma,
    tolangan: d.tolangan,
    qolgan: d.jamiSumma - d.tolangan,
    isYopilgan: d.isYopilgan,
    sana: (d.sana ?? d.createdAt).toISOString(),
    muddat: d.muddat ? d.muddat.toISOString() : null,
    oxirgiTolov: oxirgi ? (oxirgi.sana ?? oxirgi.createdAt).toISOString() : null,
    izoh: d.izoh,
    masulIsm: d.masulIsm,
    kategoriyaNomi: d.category?.nomi ?? null,
    productNomi: d.product
      ? [d.product.nomi, d.product.avtoRaqam].filter(Boolean).join(" · ")
      : null,
    muddatOtdi: !d.isYopilgan && d.muddat !== null && d.muddat.getTime() < bugun,
    tolovlar: d.payments.map((p) => ({
      id: p.id,
      summa: p.summa,
      sana: (p.sana ?? p.createdAt).toISOString(),
      tolovTuri: p.tolovTuri,
      kassaNomi: p.accountId ? kassaMap.get(p.accountId) ?? null : null,
      izoh: p.izoh,
      userIsm: userMap.get(p.userId) ?? null,
      transactionId: p.transactionId,
      createdAt: p.createdAt.toISOString(),
    })),
    yaratgan: userMap.get(d.userId) ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
    cancelledAt: d.cancelledAt ? d.cancelledAt.toISOString() : null,
    cancelReason: d.cancelReason,
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface QarzDashboardDTO {
  /** Jami ochiq qarz (olinadigan, bekor qilinganlarsiz). */
  ochiqJami: number;
  /** Bugun berilgan qarz summasi. */
  bugunBerilgan: number;
  /** Bugun qabul qilingan qarz to'lovlari. */
  bugunYopilgan: number;
  /** Muddati o'tgan ochiq qarzlar qoldig'i. */
  muddatiOtgan: number;
  /** Qarzdor mijozlar soni (ochiq qarzi borlar). */
  mijozlarSoni: number;
  /** Biz qarzdormiz — to'lanishi kerak bo'lgan pul. */
  beriladiganJami: number;
}

/**
 * Qarzlar dashboardi — beshta ko'rsatkich, beshta agregat so'rov.
 *
 * Ro'yxatni brauzerda jamlash mumkin edi, lekin u 1000 yozuv bilan
 * chegaralangan: minglab qarzi bor biznesda ko'rsatkichlar yolg'on bo'lardi.
 */
export async function getQarzDashboard(businessId: string): Promise<QarzDashboardDTO> {
  const bugunBosh = dateOnlyStringToUTCDate(todayDateOnlyString());
  const bugunOxir = new Date(bugunBosh.getTime() + 24 * 60 * 60 * 1000);

  const [ochiq, berilgan, tolangan, otgan, mijozlar, beriladigan] = await Promise.all([
    prisma.debt.aggregate({
      where: { businessId, turi: "olinadigan", isYopilgan: false },
      _sum: { jamiSumma: true, tolangan: true },
    }),
    prisma.debt.aggregate({
      where: {
        businessId,
        turi: "olinadigan",
        status: { not: "CANCELLED" },
        sana: { gte: bugunBosh, lt: bugunOxir },
      },
      _sum: { jamiSumma: true },
    }),
    prisma.debtPayment.aggregate({
      where: { businessId, sana: { gte: bugunBosh, lt: bugunOxir } },
      _sum: { summa: true },
    }),
    prisma.debt.aggregate({
      where: { businessId, turi: "olinadigan", isYopilgan: false, muddat: { lt: bugunBosh } },
      _sum: { jamiSumma: true, tolangan: true },
    }),
    prisma.debt.findMany({
      where: { businessId, turi: "olinadigan", isYopilgan: false },
      select: { contactId: true, mijozNomi: true },
    }),
    prisma.debt.aggregate({
      where: { businessId, turi: "beriladigan", isYopilgan: false },
      _sum: { jamiSumma: true, tolangan: true },
    }),
  ]);

  const qoldiq = (a: { _sum: { jamiSumma: number | null; tolangan: number | null } }) =>
    (a._sum.jamiSumma ?? 0) - (a._sum.tolangan ?? 0);

  // Mijoz kartochkasi bo'lmagan qarzlar ism bo'yicha sanaladi.
  const kalitlar = new Set(mijozlar.map((m) => m.contactId ?? `ism:${m.mijozNomi}`));

  return {
    ochiqJami: qoldiq(ochiq),
    bugunBerilgan: berilgan._sum.jamiSumma ?? 0,
    bugunYopilgan: tolangan._sum.summa ?? 0,
    muddatiOtgan: qoldiq(otgan),
    mijozlarSoni: kalitlar.size,
    beriladiganJami: qoldiq(beriladigan),
  };
}

// ---------------------------------------------------------------------------
// Mijoz taklifi (autocomplete)
// ---------------------------------------------------------------------------

export interface QarzMijozDTO {
  /** Mijoz kartochkasi IDsi — faqat MIJOZLAR moduli yozuvlarida bo'ladi. */
  contactId: string | null;
  ism: string;
  tel: string | null;
  /** Shu mijozning hozirgi ochiq qarzi (so'm). */
  ochiqQarz: number;
}

/**
 * Qarz formasidagi mijoz qidiruvi.
 *
 * Ataylab MIJOZLAR modulidan MUSTAQIL: modul o'chirilgan biznesda ham qarz
 * yozish mumkin bo'lishi kerak. Shuning uchun manba ikkita — mijoz
 * kartochkalari va oldingi qarzlardagi ism/telefon juftliklari.
 */
export async function qarzMijozlariTakror(
  businessId: string,
  q: string | null
): Promise<QarzMijozDTO[]> {
  const rejim = qidiruvRejimi();
  const qidiruv = q?.trim();

  const [contacts, debts] = await Promise.all([
    prisma.contact.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(qidiruv
          ? { OR: [{ ism: { contains: qidiruv, ...rejim } }, { tel: { contains: qidiruv, ...rejim } }] }
          : {}),
      },
      select: { id: true, ism: true, tel: true },
      orderBy: { ism: "asc" },
      take: 20,
    }),
    prisma.debt.findMany({
      where: {
        businessId,
        turi: "olinadigan",
        ...(qidiruv
          ? {
              OR: [
                { mijozNomi: { contains: qidiruv, ...rejim } },
                { mijozTel: { contains: qidiruv, ...rejim } },
              ],
            }
          : {}),
      },
      select: { contactId: true, mijozNomi: true, mijozTel: true, jamiSumma: true, tolangan: true, isYopilgan: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);

  const ochiqQarz = new Map<string, number>();
  const kartochkasizlar = new Map<string, QarzMijozDTO>();
  for (const d of debts) {
    const kalit = d.contactId ?? `ism:${d.mijozNomi.toLowerCase()}`;
    if (!d.isYopilgan) {
      ochiqQarz.set(kalit, (ochiqQarz.get(kalit) ?? 0) + (d.jamiSumma - d.tolangan));
    }
    if (!d.contactId && !kartochkasizlar.has(kalit)) {
      kartochkasizlar.set(kalit, {
        contactId: null,
        ism: d.mijozNomi,
        tel: d.mijozTel,
        ochiqQarz: 0,
      });
    }
  }

  const natija: QarzMijozDTO[] = contacts.map((c) => ({
    contactId: c.id,
    ism: c.ism,
    tel: c.tel,
    ochiqQarz: ochiqQarz.get(c.id) ?? 0,
  }));
  for (const [kalit, m] of kartochkasizlar) {
    natija.push({ ...m, ochiqQarz: ochiqQarz.get(kalit) ?? 0 });
  }

  // Ochiq qarzi borlar yuqorida — ular bilan ish ko'proq bo'ladi.
  return natija
    .sort((a, b) => b.ochiqQarz - a.ochiqQarz || a.ism.localeCompare(b.ism))
    .slice(0, 30);
}
