import { prisma } from "@/lib/prisma";
import { qidiruvRejimi } from "@/lib/db/dialect";
import { dateOnlyStringToUTCDate, todayDateOnlyString } from "@/lib/date";
import { qarzHolatHisobla, type QarzHolat } from "@/lib/validation/qarz";
import {
  muddatHolati,
  MUDDAT_TARTIBI,
  YAQIN_MUDDAT_KUN,
  type MuddatHolat,
} from "@/lib/qarzMuddat";
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
// Qarzdor kaliti
// ---------------------------------------------------------------------------

/**
 * BITTA QARZDORNING YAGONA KALITI.
 *
 * Qarz yozuvi (`Debt`) — bitta hodisa, qarzdor esa SHAXS: bir mijozning
 * o'nta ochiq qarzi bo'lishi mumkin. "8 ta qarzdor" degan raqam ham,
 * qarzdor kesimidagi ro'yxat ham shu kalit bo'yicha jamlanadi.
 *
 * Mijoz kartochkasi bo'lsa — kartochka IDsi (ism keyin o'zgarsa ham tarix
 * bir joyda qoladi). Kartochkasiz eski yozuvlar esa ISM bo'yicha
 * birlashtiriladi; registr va chetdagi bo'shliqlar farqi hisobga olinmaydi,
 * aks holda "Ali" va "ali " ikki qarzdor bo'lib ko'rinardi.
 */
export function qarzdorKalit(contactId: string | null, mijozNomi: string): string {
  return contactId ? `contact:${contactId}` : `ism:${mijozNomi.trim().toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Jamlar — bosh sahifadagi "Menga qarzdor" kartasi
// ---------------------------------------------------------------------------

export interface QarzJamlariDTO {
  /** Menga qarzdor: ochiq "olinadigan" qarzlar qoldig'i (so'm). */
  olinadigan: number;
  /** Nechta QARZDOR (shaxs) — qarz yozuvi soni EMAS. */
  olinadiganSoni: number;
  /** Men qarzdorman: ochiq "beriladigan" qarzlar qoldig'i (so'm). */
  beriladigan: number;
  /** Nechta KREDITOR (shaxs/tashkilot). */
  beriladiganSoni: number;
  /** olinadigan − beriladigan. */
  sof: number;
}

export const BOSH_QARZ_JAMLARI: QarzJamlariDTO = {
  olinadigan: 0,
  olinadiganSoni: 0,
  beriladigan: 0,
  beriladiganSoni: 0,
  sof: 0,
};

/**
 * "MENGA QARZDOR" KARTASINING MANBASI — bitta `groupBy`.
 *
 * Formula (transaksiya asosidagi hisob):
 *   qoldiq = Σ(Debt.jamiSumma) − Σ(Debt.tolangan)
 * bunda `tolangan` = tizim ichidagi barcha `DebtPayment` + qarz kiritilishidan
 * oldin to'langan qism. `isYopilgan = false` sharti yopilgan (PAID) va bekor
 * qilingan (CANCELLED) qarzlarni ikkalasini ham chiqarib tashlaydi — schema
 * izohidagi invariantga ko'ra ikkalasida ham bayroq `true`.
 *
 * Hech qanday qo'lda yuritiladigan "joriy balans" ustuni YO'Q: raqam har
 * safar yozuvlardan qayta hisoblanadi.
 */
export async function getQarzJamlari(businessId: string): Promise<QarzJamlariDTO> {
  const rows = await prisma.debt.groupBy({
    by: ["turi", "contactId", "mijozNomi"],
    where: { businessId, isYopilgan: false },
    _sum: { jamiSumma: true, tolangan: true },
  });

  const natija: QarzJamlariDTO = { ...BOSH_QARZ_JAMLARI };
  // Bir qarzdorning bir nechta ochiq qarzi bitta kalitga yig'iladi.
  const qarzdorlar = new Map<string, number>();

  for (const r of rows) {
    const qoldiq = (r._sum.jamiSumma ?? 0) - (r._sum.tolangan ?? 0);
    // Himoya: buzilgan yozuv (manfiy qoldiq) jamiga qo'shilmasin.
    if (qoldiq <= 0) continue;
    const kalit = `${r.turi}|${qarzdorKalit(r.contactId, r.mijozNomi)}`;
    qarzdorlar.set(kalit, (qarzdorlar.get(kalit) ?? 0) + qoldiq);
    if (r.turi === "beriladigan") natija.beriladigan += qoldiq;
    else natija.olinadigan += qoldiq;
  }

  for (const kalit of qarzdorlar.keys()) {
    if (kalit.startsWith("beriladigan|")) natija.beriladiganSoni += 1;
    else natija.olinadiganSoni += 1;
  }

  natija.sof = natija.olinadigan - natija.beriladigan;
  return natija;
}

// ---------------------------------------------------------------------------
// Qarzdorlar ro'yxati (shaxs kesimi)
// ---------------------------------------------------------------------------

export interface QarzdorDTO {
  /** `qarzdorKalit()` natijasi — ro'yxat va tafsilot orasidagi bog'lovchi. */
  kalit: string;
  contactId: string | null;
  /** Ekranga chiqadigan ism (birinchi uchragan yozuvdagi ko'rinish). */
  ism: string;
  tel: string | null;
  turi: string;
  /** JORIY QARZ — shu qarzdorning barcha ochiq qarzlari qoldig'i. */
  qarz: number;
  /** Ochiq qarzlarning boshlang'ich summasi (Σ jamiSumma). */
  jamiBerilgan: number;
  /** Ochiq qarzlar bo'yicha to'langan qism. */
  jamiTolangan: number;
  /** Nechta ochiq qarz yozuvi. */
  ochiqSoni: number;
  /** Oxirgi to'lov sanasi (ISO) — hech to'lov bo'lmagan bo'lsa null. */
  oxirgiTolov: string | null;
  /** Oxirgi to'lov summasi (so'm) — to'lov bo'lmasa null. */
  oxirgiTolovSumma: number | null;
  /** Eng eski ochiq qarz sanasi (ISO). */
  eskiSana: string;
  /** Eng eski ochiq qarz necha KUNLIK ("Eng eski qarz: 18 kun"). */
  eskiKun: number;
  /** Kamida bitta qarzning muddati o'tib ketgan. */
  muddatOtdi: boolean;
  /** MUDDATI O'TGAN qarzlar QOLDIG'I (so'm) — kartadagi qizil raqam. */
  muddatiOtganSumma: number;
  /** ENG YAQIN to'lov muddati (ISO) — ochiq qarzlar orasidan. */
  yaqinMuddat: string | null;
  /**
   * QARZDORNING KRITIKLIGI — eng og'ir holatdagi qarzi bo'yicha. Ro'yxat
   * shu bo'yicha tartiblanadi: muddati o'tgan → bugun → yaqin → keyingi.
   */
  muddatHolat: MuddatHolat;
  /** Muddatgacha (yoki muddatdan beri) qolgan kun — `muddatHolat` bilan juft. */
  muddatKun: number | null;
  /** Qarzdorning umumiy holati: hech to'lamaganmi yoki qisman to'laganmi. */
  status: QarzHolat;
}

/** Qarzdorlar ro'yxati filtri — hammasi SERVERDA qo'llanadi. */
export interface QarzdorFiltr {
  turi?: string | null;
  q?: string | null;
  /** Muddat kesimi: "kechikdi" | "bugun" | "yaqin". */
  muddat?: MuddatHolat | null;
  /** Holat kesimi: OPEN (hech to'lanmagan) yoki PARTIALLY_PAID. */
  status?: QarzHolat | null;
  /** Tartib: kritiklik (standart), summa yoki muddat bo'yicha. */
  tartib?: "kritik" | "summa" | "muddat" | "ism" | null;
}

/** Ochiq qarzlar bir so'rovda o'qiladigan chegara (qarzdorlar kesimi uchun). */
const QARZDOR_LIMIT = 2000;

/**
 * QARZDORLAR RO'YXATI — har qatorda bitta SHAXS, bitta qarz yozuvi emas.
 *
 * Faqat OCHIQ qarzlar o'qiladi (yopilgani va bekor qilingani chiqmaydi):
 * bu ro'yxat "kimdan qancha undirish kerak" savoliga javob beradi.
 *
 * N+1 YO'Q (31-talab): butun ro'yxat BITTA `findMany` bilan olinadi va
 * jamlanma xotirada quriladi. Har qarzdor uchun alohida so'rov qilinsa
 * 200 qarzdorli biznesda sahifa 200 ta so'rovda ochilardi.
 *
 * Filtr va tartib ham SHU YERDA: brauzerda filtrlash `QARZDOR_LIMIT` dan
 * keyingi qarzdorlarni ko'rinmas qilib qo'yardi.
 */
export async function listQarzdorlar(
  businessId: string,
  filtr: QarzdorFiltr = {}
): Promise<QarzdorDTO[]> {
  const where: Prisma.DebtWhereInput = { businessId, isYopilgan: false };
  if (filtr.turi === "olinadigan" || filtr.turi === "beriladigan") where.turi = filtr.turi;
  if (filtr.q) {
    const rejim = qidiruvRejimi();
    where.OR = [
      { mijozNomi: { contains: filtr.q, ...rejim } },
      { mijozTel: { contains: filtr.q, ...rejim } },
    ];
  }

  const debts = await prisma.debt.findMany({
    where,
    select: {
      id: true,
      turi: true,
      contactId: true,
      mijozNomi: true,
      mijozTel: true,
      jamiSumma: true,
      tolangan: true,
      muddat: true,
      sana: true,
      createdAt: true,
      payments: {
        orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { sana: true, createdAt: true, summa: true },
      },
    },
    orderBy: [{ sana: "asc" }, { createdAt: "asc" }],
    take: QARZDOR_LIMIT,
  });

  const bugunStr = todayDateOnlyString();
  const bugun = dateOnlyStringToUTCDate(bugunStr).getTime();
  const jamlanma = new Map<string, QarzdorDTO>();

  for (const d of debts) {
    const qoldiq = d.jamiSumma - d.tolangan;
    if (qoldiq <= 0) continue;
    const kalit = `${d.turi}|${qarzdorKalit(d.contactId, d.mijozNomi)}`;
    const sana = (d.sana ?? d.createdAt).toISOString();
    const muddatISO = d.muddat ? d.muddat.toISOString() : null;
    const oxirgi = d.payments[0];
    const tolovSana = oxirgi ? (oxirgi.sana ?? oxirgi.createdAt).toISOString() : null;
    const kechikdi = d.muddat !== null && d.muddat.getTime() < bugun;
    const { holat, kun } = muddatHolati(muddatISO, false, bugunStr);

    const mavjud = jamlanma.get(kalit);
    if (!mavjud) {
      jamlanma.set(kalit, {
        kalit: qarzdorKalit(d.contactId, d.mijozNomi),
        contactId: d.contactId,
        ism: d.mijozNomi,
        tel: d.mijozTel,
        turi: d.turi,
        qarz: qoldiq,
        jamiBerilgan: d.jamiSumma,
        jamiTolangan: d.tolangan,
        ochiqSoni: 1,
        oxirgiTolov: tolovSana,
        oxirgiTolovSumma: oxirgi ? oxirgi.summa : null,
        eskiSana: sana,
        eskiKun: kunFarqi(sana, bugun),
        muddatOtdi: kechikdi,
        muddatiOtganSumma: kechikdi ? qoldiq : 0,
        yaqinMuddat: muddatISO,
        muddatHolat: holat,
        muddatKun: kun,
        status: d.tolangan > 0 ? "PARTIALLY_PAID" : "OPEN",
      });
      continue;
    }
    mavjud.qarz += qoldiq;
    mavjud.jamiBerilgan += d.jamiSumma;
    mavjud.jamiTolangan += d.tolangan;
    mavjud.ochiqSoni += 1;
    mavjud.tel = mavjud.tel ?? d.mijozTel;
    if (tolovSana && (!mavjud.oxirgiTolov || tolovSana > mavjud.oxirgiTolov)) {
      mavjud.oxirgiTolov = tolovSana;
      mavjud.oxirgiTolovSumma = oxirgi ? oxirgi.summa : null;
    }
    if (sana < mavjud.eskiSana) {
      mavjud.eskiSana = sana;
      mavjud.eskiKun = kunFarqi(sana, bugun);
    }
    if (kechikdi) {
      mavjud.muddatOtdi = true;
      mavjud.muddatiOtganSumma += qoldiq;
    }
    // Eng YAQIN muddat: mavjudi yo'q bo'lsa yoki bu qarzniki oldinroq bo'lsa.
    if (muddatISO && (!mavjud.yaqinMuddat || muddatISO < mavjud.yaqinMuddat)) {
      mavjud.yaqinMuddat = muddatISO;
    }
    // Kritiklik — qarzdorning ENG OG'IR holatdagi qarzi bo'yicha.
    if (MUDDAT_TARTIBI[holat] < MUDDAT_TARTIBI[mavjud.muddatHolat]) {
      mavjud.muddatHolat = holat;
      mavjud.muddatKun = kun;
    }
    if (d.tolangan > 0) mavjud.status = "PARTIALLY_PAID";
  }

  let natija = Array.from(jamlanma.values());

  // Muddat kesimi: "kechikdi" tanlansa faqat muddati o'tgan qarzi borlar.
  if (filtr.muddat) {
    const kerakli = filtr.muddat;
    natija = natija.filter((q) =>
      kerakli === "yaqin"
        ? // "7 kun ichida" — bugun va kechikkanlar ham kirmaydi, faqat oldinda
          // turgan yaqin muddat (kechikkanlarning o'z chipi bor).
          q.muddatHolat === "yaqin"
        : q.muddatHolat === kerakli
    );
  }
  if (filtr.status) {
    natija = natija.filter((q) => q.status === filtr.status);
  }

  return saralaQarzdorlar(natija, filtr.tartib ?? "kritik");
}

/** Ikki sana orasidagi to'liq kun farqi (qarz yoshi uchun). */
function kunFarqi(sanaISO: string, bugunMs: number): number {
  const kun = Math.round((bugunMs - Date.parse(sanaISO.slice(0, 10))) / 86_400_000);
  return kun > 0 ? kun : 0;
}

/**
 * QARZDORLAR TARTIBI (14-talab).
 *
 * Standart — "kritik": muddati o'tganlar tepada, keyin bugun to'lashi
 * kerak bo'lganlar, so'ng yaqinlashayotganlar. Bir xil kritiklikdagilar
 * ichida katta summa yuqorida — u bilan ish ko'proq.
 */
function saralaQarzdorlar(
  royxat: QarzdorDTO[],
  tartib: "kritik" | "summa" | "muddat" | "ism"
): QarzdorDTO[] {
  const nusxa = [...royxat];
  switch (tartib) {
    case "summa":
      return nusxa.sort((a, b) => b.qarz - a.qarz || a.ism.localeCompare(b.ism));
    case "ism":
      return nusxa.sort((a, b) => a.ism.localeCompare(b.ism));
    case "muddat":
      // Muddatsizlar oxirida: ular bo'yicha kelishuv yo'q.
      return nusxa.sort(
        (a, b) =>
          (a.yaqinMuddat ?? "9999").localeCompare(b.yaqinMuddat ?? "9999") ||
          b.qarz - a.qarz
      );
    default:
      return nusxa.sort(
        (a, b) =>
          MUDDAT_TARTIBI[a.muddatHolat] - MUDDAT_TARTIBI[b.muddatHolat] ||
          b.muddatiOtganSumma - a.muddatiOtganSumma ||
          b.qarz - a.qarz ||
          a.ism.localeCompare(b.ism)
      );
  }
}

// ---------------------------------------------------------------------------
// Qarzdor tafsiloti (birlashgan tarix)
// ---------------------------------------------------------------------------

export interface QarzdorHodisa {
  id: string;
  /** "qarz" — qarz qo'shildi; "tolov" — to'lov qabul qilindi. */
  turi: "qarz" | "tolov";
  sana: string;
  /** Musbat qiymat; ishorani yo'nalish (`turi`) belgilaydi. */
  summa: number;
  izoh: string | null;
  debtId: string;
  /** To'lovda usul/kassa, qarzda mas'ul — bir qatorlik qo'shimcha. */
  tafsil: string | null;
}

export interface QarzdorOchiqQarz {
  id: string;
  jamiSumma: number;
  tolangan: number;
  qolgan: number;
  sana: string;
  muddat: string | null;
  status: QarzHolat;
  izoh: string | null;
  muddatOtdi: boolean;
}

export interface QarzdorTafsilotDTO {
  kalit: string;
  contactId: string | null;
  ism: string;
  tel: string | null;
  turi: string;
  /** JORIY QARZ = Σ(qarzlar) − Σ(to'lovlar), bekor qilinganlarsiz. */
  jamiQarz: number;
  /** Bekor qilinmagan barcha qarzlarning boshlang'ich summasi. */
  jamiBerilgan: number;
  /** Shu qarzlar bo'yicha to'langan jami. */
  jamiTolangan: number;
  /** Ochiq qarzlar — to'lov aynan bittasiga yoziladi. */
  ochiqQarzlar: QarzdorOchiqQarz[];
  /** Qarz va to'lovlar bitta vaqt o'qida (eskidan yangiga). */
  hodisalar: QarzdorHodisa[];
}

/**
 * BITTA QARZDORNING BUTUN TARIXI.
 *
 * Barcha qarzlari (yopilgani ham) va ular bo'yicha to'lovlari bitta vaqt
 * o'qiga tiziladi — "qancha qarz oldi, qancha to'ladi, qancha qoldi"
 * savoliga hujjatli javob. Bekor qilingan qarzlar tarixda KO'RINADI
 * (nima bo'lgani bilinsin), lekin jamiga QO'SHILMAYDI.
 */
export async function getQarzdorTafsilot(
  businessId: string,
  turi: string,
  kalit: string
): Promise<QarzdorTafsilotDTO | null> {
  const contactId = kalit.startsWith("contact:") ? kalit.slice("contact:".length) : null;
  const ismKalit = kalit.startsWith("ism:") ? kalit.slice("ism:".length) : null;
  if (!contactId && !ismKalit) return null;

  const where: Prisma.DebtWhereInput = { businessId, turi };
  if (contactId) {
    where.contactId = contactId;
  } else {
    // Kartochkasiz qarzdor — ism bo'yicha. `contains` + registr rejimi ikki
    // dialektda ham ishlaydi; aniq tenglik quyida JS'da tekshiriladi.
    where.contactId = null;
    where.mijozNomi = { contains: ismKalit as string, ...qidiruvRejimi() };
  }

  const hammasi = await prisma.debt.findMany({
    where,
    include: { payments: { orderBy: [{ sana: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ sana: "asc" }, { createdAt: "asc" }],
    take: QARZDOR_LIMIT,
  });

  const debts = ismKalit
    ? hammasi.filter((d) => d.mijozNomi.trim().toLowerCase() === ismKalit)
    : hammasi;
  if (debts.length === 0) return null;

  const bugun = dateOnlyStringToUTCDate(todayDateOnlyString()).getTime();
  const hodisalar: QarzdorHodisa[] = [];
  const ochiqQarzlar: QarzdorOchiqQarz[] = [];
  let jamiBerilgan = 0;
  let jamiTolangan = 0;
  let ism = debts[0].mijozNomi;
  let tel: string | null = null;

  for (const d of debts) {
    const bekor = holatniOqi(d) === "CANCELLED";
    tel = tel ?? d.mijozTel;
    if (d.contactId) ism = d.mijozNomi;

    hodisalar.push({
      id: `debt:${d.id}`,
      turi: "qarz",
      sana: (d.sana ?? d.createdAt).toISOString(),
      summa: d.jamiSumma,
      izoh: bekor ? `Bekor qilindi: ${d.cancelReason ?? "sabab ko'rsatilmagan"}` : d.izoh,
      debtId: d.id,
      tafsil: d.masulIsm ? `Mas'ul: ${d.masulIsm}` : null,
    });

    if (bekor) continue;
    jamiBerilgan += d.jamiSumma;
    jamiTolangan += d.tolangan;

    // Tizimga kiritilishidan OLDIN to'langan qism: to'lov yozuvi yo'q, lekin
    // usiz tarixdagi qoldiq hisobi to'g'ri chiqmaydi.
    const tolovlarJami = d.payments.reduce((acc, p) => acc + p.summa, 0);
    const oldindan = d.tolangan - tolovlarJami;
    if (oldindan > 0) {
      hodisalar.push({
        id: `oldin:${d.id}`,
        turi: "tolov",
        sana: (d.sana ?? d.createdAt).toISOString(),
        summa: oldindan,
        izoh: "Tizimdan tashqarida to'langan qism",
        debtId: d.id,
        tafsil: null,
      });
    }
    for (const p of d.payments) {
      hodisalar.push({
        id: `pay:${p.id}`,
        turi: "tolov",
        sana: (p.sana ?? p.createdAt).toISOString(),
        summa: p.summa,
        izoh: p.izoh,
        debtId: d.id,
        tafsil: p.tolovTuri,
      });
    }

    const qolgan = d.jamiSumma - d.tolangan;
    if (!d.isYopilgan && qolgan > 0) {
      ochiqQarzlar.push({
        id: d.id,
        jamiSumma: d.jamiSumma,
        tolangan: d.tolangan,
        qolgan,
        sana: (d.sana ?? d.createdAt).toISOString(),
        muddat: d.muddat ? d.muddat.toISOString() : null,
        status: holatniOqi(d),
        izoh: d.izoh,
        muddatOtdi: d.muddat !== null && d.muddat.getTime() < bugun,
      });
    }
  }

  hodisalar.sort((a, b) => a.sana.localeCompare(b.sana) || a.id.localeCompare(b.id));

  return {
    kalit,
    contactId,
    ism,
    tel,
    turi,
    jamiQarz: jamiBerilgan - jamiTolangan,
    jamiBerilgan,
    jamiTolangan,
    ochiqQarzlar,
    hodisalar,
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
  /**
   * YAQIN MUDDATLI — bugundan boshlab `YAQIN_MUDDAT_KUN` ichida to'lanishi
   * kerak bo'lgan ochiq qarzlar qoldig'i. "Muddati o'tgan" bilan
   * KESISHMAYDI: u kechikkanlar, bu esa hali kechikmaganlar.
   */
  yaqinMuddatli: number;
  /** Qarzdor mijozlar soni (ochiq qarzi borlar). */
  mijozlarSoni: number;
  /** Muddati o'tgan qarzi bor qarzdorlar soni. */
  muddatiOtganSoni: number;
  /** Biz qarzdormiz — to'lanishi kerak bo'lgan pul. */
  beriladiganJami: number;
  /** Nechta kreditor (biz qarzdor bo'lgan shaxs/tashkilot). */
  beriladiganSoni: number;
  /** "Men qarzdorman" tarafidagi muddati o'tgan majburiyat. */
  beriladiganMuddatiOtgan: number;
  /** Bugun BIZ to'lagan qarzlar (chiqim) — mijoz to'lovlaridan alohida. */
  bugunTolaganim: number;
}

/**
 * Qarzlar dashboardi — ko'rsatkichlar SERVERDA, agregat so'rovlar bilan.
 *
 * Ro'yxatni brauzerda jamlash mumkin edi, lekin u 1000 yozuv bilan
 * chegaralangan: minglab qarzi bor biznesda ko'rsatkichlar yolg'on bo'lardi.
 */
export async function getQarzDashboard(businessId: string): Promise<QarzDashboardDTO> {
  const bugunBosh = dateOnlyStringToUTCDate(todayDateOnlyString());
  const bugunOxir = new Date(bugunBosh.getTime() + 24 * 60 * 60 * 1000);

  // "Yaqin muddat" oynasi: ertadan boshlab YAQIN_MUDDAT_KUN ichida.
  const yaqinOxir = new Date(bugunBosh.getTime() + (YAQIN_MUDDAT_KUN + 1) * 24 * 60 * 60 * 1000);

  const [
    ochiq,
    berilgan,
    tolangan,
    otgan,
    yaqin,
    mijozlar,
    beriladigan,
    beriladiganOtgan,
    tolaganim,
  ] = await Promise.all([
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
    // BUGUN TO'LANGAN — mijozlardan kelgan pul. `debt.turi` bo'yicha
    // ajratiladi: biz ta'minotchiga to'lagan pul KIRIM emas, uni shu
    // kartaga qo'shish "bugun qancha pul keldi" savoliga yolg'on javob
    // berardi (26-talab).
    prisma.debtPayment.groupBy({
      by: ["debtId"],
      where: {
        businessId,
        sana: { gte: bugunBosh, lt: bugunOxir },
        debt: { turi: "olinadigan" },
      },
      _sum: { summa: true },
    }),
    prisma.debt.aggregate({
      where: { businessId, turi: "olinadigan", isYopilgan: false, muddat: { lt: bugunBosh } },
      _sum: { jamiSumma: true, tolangan: true },
    }),
    // Bugun ham shu oynaga kiradi: "bugun to'lashi kerak" — eng shoshilinch
    // yaqin muddat, uni kechikkanlar tarafiga qo'shib bo'lmaydi.
    prisma.debt.aggregate({
      where: {
        businessId,
        turi: "olinadigan",
        isYopilgan: false,
        muddat: { gte: bugunBosh, lt: yaqinOxir },
      },
      _sum: { jamiSumma: true, tolangan: true },
    }),
    // Qarzdorlar soni uchun kalitlar. Muddat ham o'qiladi: "muddati o'tgan
    // qarzdorlar soni" AYNI to'plamdan chiqadi, ikkinchi so'rov qilinmaydi.
    prisma.debt.findMany({
      where: { businessId, turi: "olinadigan", isYopilgan: false },
      select: { contactId: true, mijozNomi: true, muddat: true },
    }),
    prisma.debt.groupBy({
      by: ["contactId", "mijozNomi"],
      where: { businessId, turi: "beriladigan", isYopilgan: false },
      _sum: { jamiSumma: true, tolangan: true },
    }),
    prisma.debt.aggregate({
      where: { businessId, turi: "beriladigan", isYopilgan: false, muddat: { lt: bugunBosh } },
      _sum: { jamiSumma: true, tolangan: true },
    }),
    prisma.debtPayment.groupBy({
      by: ["debtId"],
      where: {
        businessId,
        sana: { gte: bugunBosh, lt: bugunOxir },
        debt: { turi: "beriladigan" },
      },
      _sum: { summa: true },
    }),
  ]);

  const qoldiq = (a: { _sum: { jamiSumma: number | null; tolangan: number | null } }) =>
    (a._sum.jamiSumma ?? 0) - (a._sum.tolangan ?? 0);

  // Mijoz kartochkasi bo'lmagan qarzlar ism bo'yicha sanaladi — bosh
  // sahifadagi "N ta qarzdor" bilan AYNI kalit ishlatiladi, aks holda ikki
  // ekranda ikki xil son chiqardi.
  const kalitlar = new Set(mijozlar.map((m) => qarzdorKalit(m.contactId, m.mijozNomi)));
  const kechikkanKalitlar = new Set(
    mijozlar
      .filter((m) => m.muddat !== null && m.muddat.getTime() < bugunBosh.getTime())
      .map((m) => qarzdorKalit(m.contactId, m.mijozNomi))
  );

  // Kreditorlar: bir kalitga yig'ilgan, qoldig'i musbatlari sanaladi
  // (`getQarzJamlari` bilan AYNI qoida).
  const kreditorlar = new Map<string, number>();
  let beriladiganJami = 0;
  for (const r of beriladigan) {
    const q = (r._sum.jamiSumma ?? 0) - (r._sum.tolangan ?? 0);
    if (q <= 0) continue;
    beriladiganJami += q;
    const k = qarzdorKalit(r.contactId, r.mijozNomi);
    kreditorlar.set(k, (kreditorlar.get(k) ?? 0) + q);
  }

  const jamla = (rows: { _sum: { summa: number | null } }[]) =>
    rows.reduce((acc, r) => acc + (r._sum.summa ?? 0), 0);

  return {
    ochiqJami: qoldiq(ochiq),
    bugunBerilgan: berilgan._sum.jamiSumma ?? 0,
    bugunYopilgan: jamla(tolangan),
    muddatiOtgan: qoldiq(otgan),
    yaqinMuddatli: qoldiq(yaqin),
    mijozlarSoni: kalitlar.size,
    muddatiOtganSoni: kechikkanKalitlar.size,
    beriladiganJami,
    beriladiganSoni: kreditorlar.size,
    beriladiganMuddatiOtgan: qoldiq(beriladiganOtgan),
    bugunTolaganim: jamla(tolaganim),
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
/**
 * BITTA MIJOZNING JORIY OCHIQ QARZI (so'm).
 *
 * Qarzga sotish oynasidagi "Hozirgi qarz → Yangi jami" paneli shu raqamdan
 * boshlanadi. Ataylab alohida so'rov: forma ochilganda mijoz oldindan
 * tanlangan bo'lishi mumkin (qarzdor kartochkasidan yoki yangi yaratilgandan
 * keyin) va u holda qidiruv ro'yxati umuman yuklanmaydi.
 */
export async function mijozOchiqQarzi(
  businessId: string,
  contactId: string
): Promise<number> {
  const jam = await prisma.debt.aggregate({
    where: { businessId, contactId, turi: "olinadigan", isYopilgan: false },
    _sum: { jamiSumma: true, tolangan: true },
  });
  const qoldiq = (jam._sum.jamiSumma ?? 0) - (jam._sum.tolangan ?? 0);
  return qoldiq > 0 ? qoldiq : 0;
}

export async function qarzMijozlariTakror(
  businessId: string,
  q: string | null
): Promise<QarzMijozDTO[]> {
  const rejim = qidiruvRejimi();
  const qidiruv = q?.trim();
  const izla = (xonalar: Prisma.DebtWhereInput[]) => (qidiruv ? { OR: xonalar } : {});

  const [contacts, ochiqlar, kartochkasizYozuvlar] = await Promise.all([
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
    // OCHIQ QARZ — `groupBy` bilan, TO'LIQ. Ilgari bu yerda oxirgi 300 ta
    // yozuv o'qilardi va ko'p savdoli biznesda ko'rsatilgan qarz KAM chiqardi.
    // Kassir aynan shu raqamga qarab qarzga sotadi, shuning uchun u taxminiy
    // bo'lishi mumkin emas.
    prisma.debt.groupBy({
      by: ["contactId", "mijozNomi"],
      where: { businessId, turi: "olinadigan", isYopilgan: false },
      _sum: { jamiSumma: true, tolangan: true },
    }),
    // Kartochkasiz, qarzi YOPILGAN mijozlar ham qidiruvda chiqsin — kassir
    // eski xaridorni ism bilan topa olsin. Chegara bor: bu faqat qulaylik.
    prisma.debt.findMany({
      where: {
        businessId,
        turi: "olinadigan",
        contactId: null,
        ...izla([
          { mijozNomi: { contains: qidiruv as string, ...rejim } },
          { mijozTel: { contains: qidiruv as string, ...rejim } },
        ]),
      },
      select: { mijozNomi: true, mijozTel: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  // Kartochkali mijozlarning ochiq qarzi — `contactId` bo'yicha.
  const kartochkaQarzi = new Map<string, number>();
  // Kartochkasiz qarzdorlar — `qarzdorKalit()` bilan AYNI ism kaliti bo'yicha,
  // aks holda qidiruvdagi summa qarzdorlar ro'yxatidagidan farq qilardi.
  const ismQarzi = new Map<string, number>();
  const ismKorinishi = new Map<string, { ism: string; tel: string | null }>();

  for (const r of ochiqlar) {
    const qoldiq = (r._sum.jamiSumma ?? 0) - (r._sum.tolangan ?? 0);
    if (qoldiq <= 0) continue;
    if (r.contactId) {
      kartochkaQarzi.set(r.contactId, (kartochkaQarzi.get(r.contactId) ?? 0) + qoldiq);
    } else {
      const kalit = qarzdorKalit(null, r.mijozNomi);
      ismQarzi.set(kalit, (ismQarzi.get(kalit) ?? 0) + qoldiq);
      if (!ismKorinishi.has(kalit)) ismKorinishi.set(kalit, { ism: r.mijozNomi, tel: null });
    }
  }

  for (const d of kartochkasizYozuvlar) {
    const kalit = qarzdorKalit(null, d.mijozNomi);
    const bor = ismKorinishi.get(kalit);
    if (!bor) ismKorinishi.set(kalit, { ism: d.mijozNomi, tel: d.mijozTel });
    else if (!bor.tel && d.mijozTel) bor.tel = d.mijozTel;
  }

  const matn = qidiruv?.toLowerCase() ?? null;
  const natija: QarzMijozDTO[] = contacts.map((c) => ({
    contactId: c.id,
    ism: c.ism,
    tel: c.tel,
    ochiqQarz: kartochkaQarzi.get(c.id) ?? 0,
  }));

  for (const [kalit, m] of ismKorinishi) {
    // Qidiruv kartochkasizlarga JS tomonda qo'llanadi: ochiq qarz `groupBy`
    // filtrsiz o'qiladi (jami to'g'ri chiqishi uchun), shuning uchun mos
    // kelmaydiganlari shu yerda chiqarib tashlanadi.
    if (matn && !m.ism.toLowerCase().includes(matn) && !(m.tel ?? "").includes(matn)) continue;
    natija.push({ contactId: null, ism: m.ism, tel: m.tel, ochiqQarz: ismQarzi.get(kalit) ?? 0 });
  }

  // Ochiq qarzi borlar yuqorida — ular bilan ish ko'proq bo'ladi.
  return natija
    .sort((a, b) => b.ochiqQarz - a.ochiqQarz || a.ism.localeCompare(b.ism))
    .slice(0, 30);
}
