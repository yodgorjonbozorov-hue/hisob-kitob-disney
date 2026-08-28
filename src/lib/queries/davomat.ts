import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate, utcDateToDateOnlyString } from "@/lib/date";
import { jadvalKunini, type EffektivJadval } from "@/lib/services/davomat";
import { toshkentSana, toshkentSoat } from "@/lib/davomat/vaqt";

function toshkentSanaHozir(): string {
  return toshkentSana(new Date());
}

// ---------------------------------------------------------------------------
// DTO'lar
// ---------------------------------------------------------------------------

/** Bugungi holat belgisi (direktor paneli). */
export type BugunHolat = "ishda" | "tugatdi" | "kutilmoqda" | "kelmadi" | "dam" | "tatil";

export interface BugunXodimDTO {
  employeeId: string;
  ism: string;
  lavozim: string | null;
  holat: BugunHolat;
  /** "HH:MM" (Toshkent) yoki null. */
  kelgan: string | null;
  ketgan: string | null;
  kechikishDaqiqa: number;
  jarimaDaqiqa: number;
  ishlanganDaqiqa: number;
  rejaBoshlanish: string | null;
  rejaTugash: string | null;
  kelishSelfieId: string | null;
  ketishSelfieId: string | null;
  masofaM: number | null;
  attendanceId: string | null;
}

export interface BugunDTO {
  sana: string;
  jami: number;
  ishda: number;
  kechikdi: number;
  kelmagan: number;
  tugatdi: number;
  kutilayotganJarima: number;
  xodimlar: BugunXodimDTO[];
}

type JadvalMap = Map<string, EffektivJadval | null>;

/** Har xodim uchun amaldagi jadval kunini bir so'rovda hisoblaydi. */
async function jadvallarniYukla(
  businessId: string,
  xodimlar: { id: string; workScheduleId: string | null }[],
  sana: string
): Promise<JadvalMap> {
  const jadvallar = await prisma.workSchedule.findMany({
    where: { businessId, deletedAt: null },
    include: { kunlar: true },
  });
  const byId = new Map(jadvallar.map((j) => [j.id, j]));
  const standart = jadvallar.find((j) => j.standart && j.isActive) ?? null;
  const natija: JadvalMap = new Map();
  for (const x of xodimlar) {
    const jadval = x.workScheduleId ? byId.get(x.workScheduleId) ?? null : standart;
    natija.set(x.id, jadvalKunini(jadval, sana));
  }
  return natija;
}

// ---------------------------------------------------------------------------
// Direktor: bugungi davomat paneli
// ---------------------------------------------------------------------------

export async function getBugungiDavomat(businessId: string, sana: string): Promise<BugunDTO> {
  const sanaUTC = dateOnlyStringToUTCDate(sana);
  const [xodimlar, yozuvlar, jarimaAgg] = await Promise.all([
    prisma.employee.findMany({
      where: { businessId, deletedAt: null, isActive: true },
      select: { id: true, ism: true, lavozim: true, workScheduleId: true },
      orderBy: { ism: "asc" },
    }),
    prisma.attendance.findMany({
      where: { businessId, sana: sanaUTC },
      include: {
        checks: {
          orderBy: { createdAt: "desc" },
          select: { turi: true, selfieId: true, masofaM: true },
        },
      },
    }),
    prisma.employeePenalty.aggregate({
      where: { businessId, holat: "kutilmoqda", sana: sanaUTC },
      _sum: { summa: true },
    }),
  ]);

  const jadvalMap = await jadvallarniYukla(businessId, xodimlar, sana);
  const yozuvMap = new Map(yozuvlar.map((y) => [y.employeeId, y]));

  const royxat: BugunXodimDTO[] = xodimlar.map((x) => {
    const y = yozuvMap.get(x.id);
    const jadval = jadvalMap.get(x.id) ?? null;
    let holat: BugunHolat;
    if (y?.holat === "tatil") holat = "tatil";
    else if (y?.holat === "kelmadi") holat = "kelmadi";
    else if (y?.kelganVaqt && y.ketganVaqt) holat = "tugatdi";
    else if (y?.kelganVaqt) holat = "ishda";
    else if (jadval && !jadval.ishKuni) holat = "dam";
    else holat = "kutilmoqda";

    const kelishCheck = y?.checks.find((c) => c.turi === "kelish");
    const ketishCheck = y?.checks.find((c) => c.turi === "ketish");
    return {
      employeeId: x.id,
      ism: x.ism,
      lavozim: x.lavozim,
      holat,
      kelgan: y?.kelganVaqt ? toshkentSoat(y.kelganVaqt) : null,
      ketgan: y?.ketganVaqt ? toshkentSoat(y.ketganVaqt) : null,
      kechikishDaqiqa: y?.kechikishDaqiqa ?? 0,
      jarimaDaqiqa: y?.jarimaDaqiqa ?? 0,
      ishlanganDaqiqa: y?.ishlanganDaqiqa ?? 0,
      rejaBoshlanish: y?.rejaBoshlanish ?? (jadval?.ishKuni ? jadval.boshlanish : null),
      rejaTugash: y?.rejaTugash ?? (jadval?.ishKuni ? jadval.tugash : null),
      kelishSelfieId: kelishCheck?.selfieId ?? null,
      ketishSelfieId: ketishCheck?.selfieId ?? null,
      masofaM: kelishCheck?.masofaM ?? null,
      attendanceId: y?.id ?? null,
    };
  });

  return {
    sana,
    jami: royxat.length,
    ishda: royxat.filter((r) => r.holat === "ishda").length,
    kechikdi: royxat.filter((r) => r.jarimaDaqiqa > 0).length,
    kelmagan: royxat.filter((r) => r.holat === "kutilmoqda" || r.holat === "kelmadi").length,
    tugatdi: royxat.filter((r) => r.holat === "tugatdi").length,
    kutilayotganJarima: jarimaAgg._sum.summa ?? 0,
    xodimlar: royxat,
  };
}

// ---------------------------------------------------------------------------
// Davomat tarixi (direktor filtrlari / xodimning o'z tarixi)
// ---------------------------------------------------------------------------

export interface TarixYozuvDTO {
  id: string;
  employeeId: string;
  ism: string;
  sana: string;
  holat: string;
  kelgan: string | null;
  ketgan: string | null;
  kechikishDaqiqa: number;
  jarimaDaqiqa: number;
  ishlanganDaqiqa: number;
  ertaKetishDaqiqa: number;
  ortiqchaDaqiqa: number;
  rejaBoshlanish: string | null;
  rejaTugash: string | null;
  manba: string | null;
  izoh: string | null;
  checks: {
    turi: string;
    vaqt: string;
    manba: string;
    selfieId: string | null;
    masofaM: number | null;
    aniqlikM: number | null;
    sabab: string | null;
  }[];
}

export async function getDavomatTarixi(
  businessId: string,
  filtr: { from: string; to: string; employeeId?: string; holat?: string }
): Promise<TarixYozuvDTO[]> {
  const yozuvlar = await prisma.attendance.findMany({
    where: {
      businessId,
      sana: {
        gte: dateOnlyStringToUTCDate(filtr.from),
        lte: dateOnlyStringToUTCDate(filtr.to),
      },
      ...(filtr.employeeId ? { employeeId: filtr.employeeId } : {}),
      ...(filtr.holat ? { holat: filtr.holat } : {}),
    },
    include: {
      employee: { select: { ism: true } },
      checks: {
        orderBy: { createdAt: "asc" },
        select: {
          turi: true,
          vaqt: true,
          manba: true,
          selfieId: true,
          masofaM: true,
          aniqlikM: true,
          sabab: true,
        },
      },
    },
    orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return yozuvlar.map((y) => ({
    id: y.id,
    employeeId: y.employeeId,
    ism: y.employee.ism,
    sana: utcDateToDateOnlyString(y.sana),
    holat: y.holat,
    kelgan: y.kelganVaqt ? toshkentSoat(y.kelganVaqt) : null,
    ketgan: y.ketganVaqt ? toshkentSoat(y.ketganVaqt) : null,
    kechikishDaqiqa: y.kechikishDaqiqa,
    jarimaDaqiqa: y.jarimaDaqiqa,
    ishlanganDaqiqa: y.ishlanganDaqiqa,
    ertaKetishDaqiqa: y.ertaKetishDaqiqa,
    ortiqchaDaqiqa: y.ortiqchaDaqiqa,
    rejaBoshlanish: y.rejaBoshlanish,
    rejaTugash: y.rejaTugash,
    manba: y.manba,
    izoh: y.izoh,
    checks: y.checks.map((c) => ({
      turi: c.turi,
      vaqt: toshkentSoat(c.vaqt),
      manba: c.manba,
      selfieId: c.selfieId,
      masofaM: c.masofaM,
      aniqlikM: c.aniqlikM,
      sabab: c.sabab,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Davr hisoboti (kunlik/haftalik/oylik metrikalar)
// ---------------------------------------------------------------------------

export interface DavomatHisobotDTO {
  from: string;
  to: string;
  jamiXodim: number;
  ishKunYozuvlari: number;
  keldi: number;
  kechikdi: number;
  kelmadi: number;
  davomatFoiz: number;
  jamiKechikishDaqiqa: number;
  jamiIshlanganDaqiqa: number;
  jamiOrtiqchaDaqiqa: number;
  jamiErtaKetishDaqiqa: number;
  tasdiqlanganJarima: number;
  kutilayotganJarima: number;
  bonuslar: number;
}

export async function getDavomatHisoboti(
  businessId: string,
  from: string,
  to: string
): Promise<DavomatHisobotDTO> {
  const fromUTC = dateOnlyStringToUTCDate(from);
  const toUTC = dateOnlyStringToUTCDate(to);
  const [jamiXodim, yozuvlar, tasdiqAgg, kutishAgg, bonusAgg] = await Promise.all([
    prisma.employee.count({ where: { businessId, deletedAt: null, isActive: true } }),
    prisma.attendance.findMany({
      where: { businessId, sana: { gte: fromUTC, lte: toUTC } },
      select: {
        holat: true,
        jarimaDaqiqa: true,
        kechikishDaqiqa: true,
        ishlanganDaqiqa: true,
        ortiqchaDaqiqa: true,
        ertaKetishDaqiqa: true,
      },
    }),
    prisma.employeePenalty.aggregate({
      where: { businessId, holat: "tasdiqlandi", sana: { gte: fromUTC, lte: toUTC } },
      _sum: { summa: true },
    }),
    prisma.employeePenalty.aggregate({
      where: { businessId, holat: "kutilmoqda", sana: { gte: fromUTC, lte: toUTC } },
      _sum: { summa: true },
    }),
    prisma.employeeBonus.aggregate({
      where: { businessId, sana: { gte: fromUTC, lte: toUTC } },
      _sum: { summa: true },
    }),
  ]);

  const keldi = yozuvlar.filter((y) => y.holat === "keldi" || y.holat === "yarim").length;
  const kelmadi = yozuvlar.filter((y) => y.holat === "kelmadi").length;
  const kechikdi = yozuvlar.filter((y) => y.jarimaDaqiqa > 0).length;
  const ishKunYozuvlari = keldi + kelmadi;

  return {
    from,
    to,
    jamiXodim,
    ishKunYozuvlari,
    keldi,
    kechikdi,
    kelmadi,
    davomatFoiz: ishKunYozuvlari > 0 ? Math.round((keldi / ishKunYozuvlari) * 100) : 0,
    jamiKechikishDaqiqa: yozuvlar.reduce((a, y) => a + y.kechikishDaqiqa, 0),
    jamiIshlanganDaqiqa: yozuvlar.reduce((a, y) => a + y.ishlanganDaqiqa, 0),
    jamiOrtiqchaDaqiqa: yozuvlar.reduce((a, y) => a + y.ortiqchaDaqiqa, 0),
    jamiErtaKetishDaqiqa: yozuvlar.reduce((a, y) => a + y.ertaKetishDaqiqa, 0),
    tasdiqlanganJarima: tasdiqAgg._sum.summa ?? 0,
    kutilayotganJarima: kutishAgg._sum.summa ?? 0,
    bonuslar: bonusAgg._sum.summa ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Xodimning o'zi: bugungi holat (mobil check-in sahifasi)
// ---------------------------------------------------------------------------

export interface MenHolatDTO {
  xodim: { id: string; ism: string; lavozim: string | null } | null;
  sana: string;
  jadval: {
    nomi: string;
    ishKuni: boolean;
    boshlanish: string | null;
    tugash: string | null;
    imtiyozDaqiqa: number;
  } | null;
  siyosat: { selfieTalab: boolean; gpsTalab: boolean; radiusTalab: boolean };
  ishJoyi: { nomi: string; radiusM: number } | null;
  bugun: {
    holat: string;
    kelgan: string | null;
    ketgan: string | null;
    kechikishDaqiqa: number;
    jarimaDaqiqa: number;
    ishlanganDaqiqa: number;
  } | null;
}

/** Sessiya foydalanuvchisining bugungi davomat holati (faqat o'zi). */
export async function getMenHolati(businessId: string, userId: string): Promise<MenHolatDTO> {
  const sana = toshkentSanaHozir();
  const bosh: MenHolatDTO = {
    xodim: null,
    sana,
    jadval: null,
    siyosat: { selfieTalab: true, gpsTalab: true, radiusTalab: true },
    ishJoyi: null,
    bugun: null,
  };

  const xodim = await prisma.employee.findFirst({
    where: { businessId, userId, deletedAt: null, isActive: true },
    include: { workSchedule: { include: { kunlar: true } }, workLocation: true },
  });
  if (!xodim) return bosh;

  const jadvalManbai =
    xodim.workSchedule ??
    (await prisma.workSchedule.findFirst({
      where: { businessId, standart: true, isActive: true, deletedAt: null },
      include: { kunlar: true },
    }));
  const jadval = jadvalKunini(jadvalManbai, sana);

  const ishJoyi =
    xodim.workLocation ??
    (await prisma.workLocation.findFirst({
      where: { businessId, standart: true, isActive: true, deletedAt: null },
    }));

  const bugun = await prisma.attendance.findFirst({
    where: { businessId, employeeId: xodim.id, sana: dateOnlyStringToUTCDate(sana) },
  });

  return {
    xodim: { id: xodim.id, ism: xodim.ism, lavozim: xodim.lavozim },
    sana,
    jadval: jadval
      ? {
          nomi: jadval.nomi,
          ishKuni: jadval.ishKuni,
          boshlanish: jadval.boshlanish,
          tugash: jadval.tugash,
          imtiyozDaqiqa: jadval.imtiyozDaqiqa,
        }
      : null,
    siyosat: {
      selfieTalab: xodim.selfieTalab,
      gpsTalab: xodim.gpsTalab,
      radiusTalab: xodim.radiusTalab,
    },
    // Aniq koordinatalar ataylab yuborilmaydi — radius tekshiruvi serverda.
    ishJoyi: ishJoyi ? { nomi: ishJoyi.nomi, radiusM: ishJoyi.radiusM } : null,
    bugun: bugun
      ? {
          holat: bugun.holat,
          kelgan: bugun.kelganVaqt ? toshkentSoat(bugun.kelganVaqt) : null,
          ketgan: bugun.ketganVaqt ? toshkentSoat(bugun.ketganVaqt) : null,
          kechikishDaqiqa: bugun.kechikishDaqiqa,
          jarimaDaqiqa: bugun.jarimaDaqiqa,
          ishlanganDaqiqa: bugun.ishlanganDaqiqa,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Jarima va bonus ro'yxatlari
// ---------------------------------------------------------------------------

export interface JarimaDTO {
  id: string;
  employeeId: string;
  ism: string;
  sana: string;
  summa: number;
  aslSumma: number;
  sabab: string;
  manba: string;
  holat: string;
  izoh: string | null;
  kechikishDaqiqa: number | null;
  createdAt: string;
}

export async function listJarimalar(
  businessId: string,
  filtr: { holat?: string; from?: string; to?: string; employeeId?: string }
): Promise<JarimaDTO[]> {
  const rows = await prisma.employeePenalty.findMany({
    where: {
      businessId,
      ...(filtr.holat ? { holat: filtr.holat } : {}),
      ...(filtr.employeeId ? { employeeId: filtr.employeeId } : {}),
      ...(filtr.from || filtr.to
        ? {
            sana: {
              ...(filtr.from ? { gte: dateOnlyStringToUTCDate(filtr.from) } : {}),
              ...(filtr.to ? { lte: dateOnlyStringToUTCDate(filtr.to) } : {}),
            },
          }
        : {}),
    },
    include: {
      employee: { select: { ism: true } },
      attendance: { select: { kechikishDaqiqa: true } },
    },
    orderBy: [{ holat: "asc" }, { sana: "desc" }],
    take: 300,
  });
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    ism: r.employee.ism,
    sana: utcDateToDateOnlyString(r.sana),
    summa: r.summa,
    aslSumma: r.aslSumma,
    sabab: r.sabab,
    manba: r.manba,
    holat: r.holat,
    izoh: r.izoh,
    kechikishDaqiqa: r.attendance?.kechikishDaqiqa ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface BonusDTO {
  id: string;
  employeeId: string;
  ism: string;
  sana: string;
  summa: number;
  sabab: string;
  izoh: string | null;
}

export async function listBonuslar(
  businessId: string,
  filtr: { from?: string; to?: string; employeeId?: string }
): Promise<BonusDTO[]> {
  const rows = await prisma.employeeBonus.findMany({
    where: {
      businessId,
      ...(filtr.employeeId ? { employeeId: filtr.employeeId } : {}),
      ...(filtr.from || filtr.to
        ? {
            sana: {
              ...(filtr.from ? { gte: dateOnlyStringToUTCDate(filtr.from) } : {}),
              ...(filtr.to ? { lte: dateOnlyStringToUTCDate(filtr.to) } : {}),
            },
          }
        : {}),
    },
    include: { employee: { select: { ism: true } } },
    orderBy: { sana: "desc" },
    take: 300,
  });
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    ism: r.employee.ism,
    sana: utcDateToDateOnlyString(r.sana),
    summa: r.summa,
    sabab: r.sabab,
    izoh: r.izoh,
  }));
}
