import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessQueryRaw, businessScope, sanaKalit, songa } from "@/lib/db/businessRaw";
import { getAccountBalances } from "@/lib/queries/accounts";
import { getTodayTotals } from "@/lib/queries/shift";
import {
  dateOnlyStringToUTCDate,
  utcDateToDateOnlyString,
  shiftMonthString,
  monthRangeUTC,
} from "@/lib/date";
import { qarzEmasSql } from "@/lib/qarzFiltr";
import { formatMoneyCompact } from "@/lib/format";

/**
 * BOSHQARUV PANELI (/app) uchun so'rovlar.
 *
 * `queries/dashboard.ts` oy kesimidagi klassik agregatlarni beradi; bu fayl
 * esa panelning YANGI bloklarini: kassa qoldig'i, pul oqimi seriyasi,
 * bugungi holat va "diqqat talab qiladi" ogohlantirishlari.
 *
 * QOIDALAR (o'zgartirilmaydi):
 *  - hamma so'rov `businessId` bilan cheklanadi; xom SQL faqat
 *    `businessRaw` yordamchilari orqali (ular tenant shartini SQL ichiga
 *    JOIN bilan kiritadi);
 *  - pul har doim `Int` (so'm);
 *  - qarzga yozilgan kirim pul emas — `qarzEmasSql` filtri saqlanadi;
 *  - yumshoq o'chirilgan yozuv hech qayerda hisobga olinmaydi.
 */

const KUN_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// 1. KASSADA — barcha faol kassalarning JORIY qoldig'i
// ---------------------------------------------------------------------------

export interface KassaBolim {
  /** `Account.turi` — "naqd" | "plastik" | "bank". */
  turi: string;
  qoldiq: number;
}

export interface KassaXulosa {
  /** Faol kassalar qoldig'i jami (kirim − chiqim ± transferlar). */
  jami: number;
  /** Nechta faol kassa hisobga olindi. */
  kassaSoni: number;
  /** Kassa turi bo'yicha kesim — faqat MAVJUD turlar (bo'sh qator chiqmaydi). */
  bolimlar: KassaBolim[];
}

/**
 * "Kassada" kartasi — TARIXIY KIRIM EMAS, joriy qoldiq.
 *
 * Manba `getAccountBalances` (Kassalar sahifasi bilan AYNI hisob): qoldiq
 * ledgerdan — kirim − chiqim + kirgan transfer − chiqqan transfer.
 * Faqat FAOL kassalar: yopilgan kassa qoldig'i boshqa kassaga ko'chirilgan
 * bo'lishi kerak, uni yana qo'shish pulni ikki marta sanardi.
 */
export async function getKassaXulosa(businessId: string): Promise<KassaXulosa> {
  const qoldiqlar = (await getAccountBalances(businessId)).filter((a) => a.isActive);
  const turlar = new Map<string, number>();
  let jami = 0;
  for (const a of qoldiqlar) {
    jami += a.qoldiq;
    turlar.set(a.turi, (turlar.get(a.turi) ?? 0) + a.qoldiq);
  }
  return {
    jami,
    kassaSoni: qoldiqlar.length,
    bolimlar: [...turlar.entries()]
      .map(([turi, qoldiq]) => ({ turi, qoldiq }))
      .sort((a, b) => b.qoldiq - a.qoldiq),
  };
}

// ---------------------------------------------------------------------------
// 2. PUL OQIMI — kunlik (92 kun) va oylik (12 oy) seriya
// ---------------------------------------------------------------------------

export interface OqimNuqta {
  /** Kunlik seriyada "YYYY-MM-DD", oylik seriyada "YYYY-MM". */
  kalit: string;
  kirim: number;
  chiqim: number;
  /** kirim − chiqim */
  sof: number;
}

export interface PulOqimi {
  /** Oxirgi 92 kun (ikkala chet kiradi) — 7 kun / 30 kun / 3 oy filtrlari shundan. */
  kunlik: OqimNuqta[];
  /** Oxirgi 12 oy — "1 yil" filtri shundan. */
  oylik: OqimNuqta[];
  /** Seriya tugaydigan kun, "YYYY-MM-DD". */
  oxirgiKun: string;
}

/** Kunlik seriya uzunligi — 3 oylik filtr uchun yetarli. */
export const OQIM_KUNLAR = 92;
/** Oylik seriya uzunligi — "1 yil" filtri. */
export const OQIM_OYLAR = 12;

interface OqimQator {
  kalit: string;
  turi: string;
  summa: unknown;
}

/** Bo'sh nuqtalar ham qoladi — grafikda uzilish bo'lmasin. */
function seriyaTuzat(kalitlar: string[], rows: OqimQator[]): OqimNuqta[] {
  const xarita = new Map<string, OqimNuqta>(
    kalitlar.map((k) => [k, { kalit: k, kirim: 0, chiqim: 0, sof: 0 }])
  );
  for (const r of rows) {
    const nuqta = xarita.get(r.kalit);
    // Oraliqdan tashqaridagi kalit (bo'lishi mumkin emas, lekin himoya) tashlanadi.
    if (!nuqta) continue;
    if (r.turi === "kirim") nuqta.kirim += songa(r.summa);
    else nuqta.chiqim += songa(r.summa);
    nuqta.sof = nuqta.kirim - nuqta.chiqim;
  }
  return kalitlar.map((k) => xarita.get(k)!);
}

/**
 * PUL OQIMI GRAFIGI ma'lumoti — IKKI so'rov, to'rtta filtr.
 *
 * Kunlik seriya 92 kunni qamraydi, shuning uchun "7 kun", "30 kun" va
 * "3 oy" filtrlari klientda kesib olinadi: filtr almashtirilganda yangi
 * so'rov KETMAYDI. "1 yil" esa oylik seriyadan — 365 ta kunlik nuqta
 * telefonda o'qilmaydi.
 *
 * `oxirgiKun` — tanlangan oy konteksti: joriy oyda bugun, o'tgan oyda
 * o'sha oyning oxirgi kuni (grafik kartalar bilan bir davrni ko'rsatadi).
 */
export async function getPulOqimi(businessId: string, oxirgiKun: string): Promise<PulOqimi> {
  const oxirgi = dateOnlyStringToUTCDate(oxirgiKun);
  const kunFrom = new Date(oxirgi.getTime() - (OQIM_KUNLAR - 1) * KUN_MS);
  const kunTo = new Date(oxirgi.getTime() + KUN_MS); // ochiq chet

  const oxirgiOy = oxirgiKun.slice(0, 7);
  const boshOy = shiftMonthString(oxirgiOy, -(OQIM_OYLAR - 1));
  const oyFrom = monthRangeUTC(boshOy).from;
  const oyTo = monthRangeUTC(oxirgiOy).to;

  const [kunRows, oyRows] = await Promise.all([
    businessQueryRaw<OqimQator>(Prisma.sql`
      SELECT ${sanaKalit('t."sana"', 10)} AS kalit, t."turi" AS turi, SUM(t."summa") AS summa
      FROM "Transaction" t
      JOIN "Business" b ON b."id" = t."businessId"
      WHERE ${businessScope("t", businessId)}
        AND t."deletedAt" IS NULL
        AND ${qarzEmasSql("t")}
        AND t."sana" >= ${kunFrom}
        AND t."sana" < ${kunTo}
      GROUP BY kalit, t."turi"
    `),
    businessQueryRaw<OqimQator>(Prisma.sql`
      SELECT ${sanaKalit('t."sana"', 7)} AS kalit, t."turi" AS turi, SUM(t."summa") AS summa
      FROM "Transaction" t
      JOIN "Business" b ON b."id" = t."businessId"
      WHERE ${businessScope("t", businessId)}
        AND t."deletedAt" IS NULL
        AND ${qarzEmasSql("t")}
        AND t."sana" >= ${oyFrom}
        AND t."sana" < ${oyTo}
      GROUP BY kalit, t."turi"
    `),
  ]);

  const kunKalitlar: string[] = [];
  for (let i = OQIM_KUNLAR - 1; i >= 0; i--) {
    kunKalitlar.push(utcDateToDateOnlyString(new Date(oxirgi.getTime() - i * KUN_MS)));
  }
  const oyKalitlar: string[] = [];
  for (let i = OQIM_OYLAR - 1; i >= 0; i--) {
    oyKalitlar.push(shiftMonthString(oxirgiOy, -i));
  }

  return {
    kunlik: seriyaTuzat(kunKalitlar, kunRows),
    oylik: seriyaTuzat(oyKalitlar, oyRows),
    oxirgiKun,
  };
}

// ---------------------------------------------------------------------------
// 3. BUGUNGI HOLAT
// ---------------------------------------------------------------------------

export interface BugungiCrm {
  /** Bugun qabul qilingan buyurtmalar soni. */
  yangi: number;
  /** Bugun YUTILDI bosqichiga tushgan buyurtmalar soni. */
  yutilgan: number;
  /** Shu yutilgan buyurtmalarning jami summasi. */
  yutilganSumma: number;
}

export interface BugungiHolat {
  sana: string;
  kirim: number;
  chiqim: number;
  /** kirim − chiqim */
  sof: number;
  /** CRM moduli ochiq bo'lsa — bugungi buyurtmalar kesimi, aks holda null. */
  crm: BugungiCrm | null;
  /** Qarz ko'rish huquqi bo'lsa — bugun qarzga yozilgan summa, aks holda null. */
  qarzBugun: { summa: number; soni: number } | null;
}

/**
 * "Bugungi holat" bloki. Faqat SO'RALGAN kesimlar hisoblanadi — modul yoki
 * huquq yopiq bo'lsa so'rov umuman ketmaydi (ortiqcha DB yuki ham, ortiqcha
 * ma'lumot ham yo'q).
 *
 * `sana` — Toshkent kuni (chaqiruvchi beradi): server UTC'da ishlaydi va
 * kechqurun "bugun" ikki xil bo'lib qolmasin.
 */
export async function getBugungiHolat(
  businessId: string,
  sana: string,
  opts: { crm: boolean; qarz: boolean }
): Promise<BugungiHolat> {
  const kunBoshi = dateOnlyStringToUTCDate(sana);
  const kunOxiri = new Date(kunBoshi.getTime() + KUN_MS);

  const [pul, crmYangi, crmYutilgan, qarzBugun] = await Promise.all([
    getTodayTotals(businessId, sana),
    opts.crm
      ? prisma.deal.count({
          where: { businessId, deletedAt: null, sana: { gte: kunBoshi, lt: kunOxiri } },
        })
      : Promise.resolve(null),
    // YUTILGAN — bosqich turi WON va bitim BUGUN yopilgan. `yopilganAt`
    // bo'yicha kesiladi: buyurtma kecha kelib bugun yutilishi mumkin.
    opts.crm
      ? prisma.deal.aggregate({
          where: {
            businessId,
            deletedAt: null,
            stage: { is: { turi: "WON" } },
            yopilganAt: { gte: kunBoshi, lt: kunOxiri },
          },
          _count: { _all: true },
          _sum: { summa: true },
        })
      : Promise.resolve(null),
    opts.qarz
      ? prisma.debt.aggregate({
          where: {
            businessId,
            turi: "olinadigan",
            status: { not: "CANCELLED" },
            sana: { gte: kunBoshi, lt: kunOxiri },
          },
          _count: { _all: true },
          _sum: { jamiSumma: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    sana,
    kirim: pul.kirim,
    chiqim: pul.chiqim,
    sof: pul.kirim - pul.chiqim,
    crm:
      crmYangi === null || crmYutilgan === null
        ? null
        : {
            yangi: crmYangi,
            yutilgan: crmYutilgan._count._all,
            yutilganSumma: crmYutilgan._sum.summa ?? 0,
          },
    qarzBugun:
      qarzBugun === null
        ? null
        : { summa: qarzBugun._sum.jamiSumma ?? 0, soni: qarzBugun._count._all },
  };
}

// ---------------------------------------------------------------------------
// 4. DIQQAT TALAB QILADI
// ---------------------------------------------------------------------------

export interface DiqqatAlert {
  /** Barqaror kalit — test va React `key` uchun. */
  kod: string;
  daraja: "danger" | "warning";
  matn: string;
  /** Ikkinchi qator (summa yoki tafsilot) — bo'lmasa ko'rsatilmaydi. */
  qoshimcha: string | null;
  href: string;
  /** Havola yorlig'i ("Qarzlar sahifasi"). */
  havolaMatni: string;
}

export interface DiqqatKirish {
  /** Qarz ko'rish huquqi bor (muddati o'tgan qarzlar). */
  qarz: boolean;
  /** Kassa ko'rish huquqi bor (kutilayotgan o'tkazmalar). */
  kassa: boolean;
  /** OMBOR moduli ochiq va biznes omborli (tugagan/kam qolgan mahsulot). */
  ombor: boolean;
  /** CRM moduli ochiq (bugungi follow-up). */
  crm: boolean;
  /** VAZIFALAR moduli ochiq (muddati kelgan vazifalar). */
  vazifalar: boolean;
}

/**
 * FAQAT ANIQ HISOBLANADIGAN OGOHLANTIRISHLAR.
 *
 * Taxminiy holat YOZILMAYDI. Masalan "ombor kam qoldi" faqat mahsulotning
 * O'Z `minQoldiq` chegarasi qo'yilgan bo'lsa chiqadi — butun tizim uchun
 * bitta sobit chegara (5 dona) tuxum sotuvchiga ham, avtomobil sotuvchiga
 * ham bir xil bo'lib, yolg'on ogohlantirish berardi.
 *
 * Har bir blok modul/huquq bilan yopiladi: yopiq bo'lsa so'rov ketmaydi.
 */
export async function getDiqqatAlertlari(
  businessId: string,
  bugunStr: string,
  kirish: DiqqatKirish
): Promise<DiqqatAlert[]> {
  const bugun = dateOnlyStringToUTCDate(bugunStr);
  const ertaga = new Date(bugun.getTime() + KUN_MS);

  const [qarzOtgan, ozQarzOtgan, kutayotganTransfer, mahsulotlar, crmBugun, vazifalar] =
    await Promise.all([
      // Muddati o'tgan qarzlar (menga qarzdor). Muddat QO'YILGAN va o'tgan.
      kirish.qarz
        ? prisma.debt.findMany({
            where: {
              businessId,
              isYopilgan: false,
              turi: "olinadigan",
              muddat: { lt: bugun },
            },
            select: { jamiSumma: true, tolangan: true },
          })
        : Promise.resolve(null),
      // Men qarzdorman — kelishilgan muddati o'tganlari.
      kirish.qarz
        ? prisma.debt.findMany({
            where: {
              businessId,
              isYopilgan: false,
              turi: "beriladigan",
              muddat: { lt: bugun },
            },
            select: { jamiSumma: true, tolangan: true },
          })
        : Promise.resolve(null),
      // Qabul qilinmagan o'tkazma: pul yuboruvchida "osilib" turibdi.
      kirish.kassa
        ? prisma.accountTransfer.aggregate({
            where: { businessId, holat: "kutilmoqda" },
            _count: { _all: true },
            _sum: { summa: true },
          })
        : Promise.resolve(null),
      kirish.ombor
        ? prisma.product.findMany({
            where: { businessId, isActive: true },
            select: { nomi: true, miqdor: true, minQoldiq: true, birlik: true },
            orderBy: { miqdor: "asc" },
            take: 500,
          })
        : Promise.resolve(null),
      // CRM follow-up: kelishilgan muddati BUGUN va bitim hali ochiq.
      kirish.crm
        ? prisma.deal.count({
            where: {
              businessId,
              deletedAt: null,
              stage: { is: { turi: "OPEN" } },
              muddat: { gte: bugun, lt: ertaga },
            },
          })
        : Promise.resolve(null),
      // Muddati kelgan yoki o'tgan bajarilmagan vazifalar.
      kirish.vazifalar
        ? prisma.task.findMany({
            where: {
              businessId,
              deletedAt: null,
              holat: { not: "BAJARILDI" },
              muddat: { lt: ertaga },
            },
            select: { muddat: true },
            take: 500,
          })
        : Promise.resolve(null),
    ]);

  const out: DiqqatAlert[] = [];
  const qoldiqJami = (rows: { jamiSumma: number; tolangan: number }[]) =>
    rows.reduce((a, d) => a + Math.max(0, d.jamiSumma - d.tolangan), 0);

  if (qarzOtgan && qarzOtgan.length > 0) {
    out.push({
      kod: "qarz-muddat",
      daraja: "danger",
      matn: `${qarzOtgan.length} ta qarz muddati o'tgan`,
      qoshimcha: somMatn(qoldiqJami(qarzOtgan)),
      href: "/app/qarzlar?turi=olinadigan",
      havolaMatni: "Qarzlar",
    });
  }

  if (ozQarzOtgan && ozQarzOtgan.length > 0) {
    out.push({
      kod: "oz-qarz-muddat",
      daraja: "danger",
      matn: `${ozQarzOtgan.length} ta to'lovingiz muddati o'tgan`,
      qoshimcha: somMatn(qoldiqJami(ozQarzOtgan)),
      href: "/app/qarzlar?turi=beriladigan",
      havolaMatni: "Qarzlar",
    });
  }

  if (kutayotganTransfer && kutayotganTransfer._count._all > 0) {
    out.push({
      kod: "kassa-otkazma",
      daraja: "warning",
      matn: `${kutayotganTransfer._count._all} ta o'tkazma qabul qilinmagan`,
      qoshimcha: somMatn(kutayotganTransfer._sum.summa ?? 0),
      href: "/app/kassa",
      havolaMatni: "Kassalar",
    });
  }

  if (crmBugun && crmBugun > 0) {
    out.push({
      kod: "crm-bugun",
      daraja: "warning",
      matn: `${crmBugun} ta buyurtma muddati bugun`,
      qoshimcha: null,
      href: "/app/crm",
      havolaMatni: "CRM",
    });
  }

  if (vazifalar && vazifalar.length > 0) {
    const otgan = vazifalar.filter((v) => v.muddat !== null && v.muddat.getTime() < bugun.getTime());
    out.push({
      kod: "vazifa-muddat",
      daraja: otgan.length > 0 ? "danger" : "warning",
      matn:
        otgan.length > 0
          ? `${otgan.length} ta vazifa muddati o'tgan`
          : `${vazifalar.length} ta vazifa muddati bugun`,
      qoshimcha:
        otgan.length > 0 && vazifalar.length > otgan.length
          ? `yana ${vazifalar.length - otgan.length} tasining muddati bugun`
          : null,
      href: "/app/vazifalar",
      havolaMatni: "Vazifalar",
    });
  }

  if (mahsulotlar) {
    const tugagan = mahsulotlar.filter((p) => p.miqdor <= 0);
    // CHEGARA FAQAT MAHSULOTNING O'ZIDA bo'lsa ishlatiladi (minQoldiq > 0).
    // Sobit "default chegara" o'ylab topilmaydi — u yolg'on signal berardi.
    const kam = mahsulotlar.filter((p) => p.miqdor > 0 && p.minQoldiq > 0 && p.miqdor <= p.minQoldiq);
    if (tugagan.length > 0) {
      out.push({
        kod: "ombor-tugadi",
        daraja: "danger",
        matn: `${tugagan.length} ta mahsulot omborda qolmadi`,
        qoshimcha: tugagan
          .slice(0, 3)
          .map((p) => p.nomi)
          .join(", "),
        href: "/app/ombor",
        havolaMatni: "Ombor",
      });
    }
    if (kam.length > 0) {
      out.push({
        kod: "ombor-kam",
        daraja: "warning",
        matn: `${kam.length} ta mahsulot minimal qoldiqdan kam`,
        qoshimcha:
          kam.length === 1 ? `"${kam[0].nomi}" — ${kam[0].miqdor} ${kam[0].birlik} qoldi` : null,
        href: "/app/ombor",
        havolaMatni: "Ombor",
      });
    }
  }

  return out;
}

/** Alert ichidagi summa qatori. Format `lib/format.ts` bilan bir xil. */
function somMatn(summa: number): string {
  return `${formatMoneyCompact(summa)} so'm`;
}
