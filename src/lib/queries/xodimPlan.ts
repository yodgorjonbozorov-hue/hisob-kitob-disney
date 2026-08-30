import { prisma } from "@/lib/prisma";
import { monthRangeUTC } from "@/lib/date";
import type { PlanTuri } from "@/lib/validation/hr";

/**
 * XODIM PLANI VA SAMARADORLIK HISOBI.
 *
 * Natija (actual) bazada SAQLANMAYDI — har o'qishda manbadan hisoblanadi,
 * shuning uchun keyingi oy plan o'zgarsa ham o'tgan oy foizi buzilmaydi
 * (plan yozuvi oyga qotirilgan, manba esa o'sha oy oralig'ida o'qiladi).
 *
 * MANBALAR (double counting yo'q):
 *  - "zakaz"/"savdo" — kirim tranzaksiyalari `sotuvchiId ?? userId` kesimida
 *    (lib/queries/xodimStatistika.ts bilan AYNAN bir xil qoida): CRM zakazi
 *    kirimga 1-1 bog'langani (Deal.transactionId UNIQUE) uchun bitta zakaz
 *    BIR marta sanaladi; qarz TO'LOVI yozuvlari chiqariladi — qarzga savdo
 *    faqat savdo kunida sanaladi.
 *  - "kirim" — haqiqatda kelib tushgan pul: qarzga savdo yozuvi (pul kelmagan)
 *    chiqariladi, qarz to'lovlari esa KIRADI. Shu bois "savdo" bilan "kirim"
 *    bitta summani ikki xil kesmaydi: biri savdo qiymati, biri kelgan pul.
 *  - "vazifa" — oy ichida BAJARILGAN xodim vazifalari (Task.employeeId,
 *    bajarildiAt shu oyda).
 */

export interface PlanDTO {
  id: string;
  oy: string;
  planTuri: PlanTuri;
  maqsad: number;
  natija: number;
  /** natija / maqsad × 100 (butun; 100 dan oshishi mumkin). */
  foiz: number;
  izoh: string | null;
}

export interface VazifaStatDTO {
  /** Oyga tegishli (bekor qilinmagan) vazifalar. */
  jami: number;
  bajarildi: number;
  /** Muddati o'tgan, hali yopilmagan vazifalar (holatidan qat'i nazar oy filtrisiz). */
  kechikkan: number;
}

export interface XodimPerformanceDTO {
  id: string;
  ism: string;
  lavozim: string | null;
  rasmUrl: string | null;
  isActive: boolean;
  /** "faol" | "tatil" | "ketgan" — bugungi davomat va isActive'dan chiqariladi. */
  holat: "faol" | "tatil" | "ketgan";
  /** Tizim hisobi bog'langanmi (zakaz/savdo/kirim planlari shunga tayanadi). */
  userId: string | null;
  plan: PlanDTO | null;
  /** Oy ichidagi zakazlar soni va savdo summasi (plan turidan qat'i nazar kartada ko'rinadi). */
  zakazlar: number;
  savdo: number;
  vazifa: VazifaStatDTO;
}

export interface PerformanceDashboardDTO {
  faolXodim: number;
  /** Plani bor xodimlar bo'yicha o'rtacha bajarilish foizi. */
  ortachaFoiz: number | null;
  /** 100% va undan yuqori bajarganlar soni. */
  bajarganlar: number;
  /** Plani bor, lekin hali 100% ga yetmaganlar soni. */
  ortda: number;
  engYaxshi: { id: string; ism: string; foiz: number } | null;
}

export interface XodimlarPerformanceDTO {
  oy: string;
  dashboard: PerformanceDashboardDTO;
  xodimlar: XodimPerformanceDTO[];
}

function foizHisobla(natija: number, maqsad: number): number {
  return maqsad > 0 ? Math.round((natija / maqsad) * 100) : 0;
}

/** Qarz to'lovi sifatida yozilgan kirim tranzaksiyalari id'lari. */
async function qarzTolovTxIdlari(businessId: string): Promise<Set<string>> {
  const rows = await prisma.debtPayment.findMany({
    where: { businessId, transactionId: { not: null } },
    select: { transactionId: true },
  });
  return new Set(rows.map((r) => r.transactionId!).filter(Boolean));
}

interface UserOyStat {
  zakazlar: number;
  savdo: number;
  kirim: number;
}

/**
 * Oy bo'yicha foydalanuvchi kesimidagi zakaz/savdo/kirim jamlari.
 * Bitta o'qish — barcha xodimlar uchun (kartochkalar ro'yxati N+1 qilmaydi).
 */
async function userOyStatlari(businessId: string, oy: string): Promise<Map<string, UserOyStat>> {
  const { from, to } = monthRangeUTC(oy);
  const tolovIdlar = await qarzTolovTxIdlari(businessId);

  const rows = await prisma.transaction.findMany({
    where: { businessId, turi: "kirim", deletedAt: null, sana: { gte: from, lt: to } },
    select: { id: true, summa: true, tolovTuri: true, sotuvchiId: true, userId: true },
  });

  const jam = new Map<string, UserOyStat>();
  for (const t of rows) {
    const kim = t.sotuvchiId ?? t.userId;
    const m = jam.get(kim) ?? { zakazlar: 0, savdo: 0, kirim: 0 };
    const qarzTolovi = tolovIdlar.has(t.id);
    if (!qarzTolovi) {
      // Savdo qiymati: qarzga savdo ham savdo kunida to'liq sanaladi.
      m.zakazlar += 1;
      m.savdo += t.summa;
    }
    // Kelgan pul: qarzga savdo yozuvida pul kelmagan, to'lov yozuvida kelgan.
    if (t.tolovTuri !== "qarz") {
      m.kirim += t.summa;
    }
    jam.set(kim, m);
  }
  return jam;
}

/** Oyga tegishli vazifalar statistikasi — barcha xodimlar bo'yicha bitta o'qish. */
async function vazifaOyStatlari(
  businessId: string,
  oy: string,
  bugun: Date
): Promise<Map<string, VazifaStatDTO>> {
  const { from, to } = monthRangeUTC(oy);
  const rows = await prisma.task.findMany({
    where: { businessId, deletedAt: null, employeeId: { not: null } },
    select: {
      employeeId: true,
      holat: true,
      muddat: true,
      boshlanish: true,
      bajarildiAt: true,
      createdAt: true,
    },
  });

  const jam = new Map<string, VazifaStatDTO>();
  for (const t of rows) {
    const id = t.employeeId!;
    const m = jam.get(id) ?? { jami: 0, bajarildi: 0, kechikkan: 0 };
    // Oyga tegishlilik: muddat ustun, bo'lmasa boshlanish, bo'lmasa yaratilgan kun.
    const sana = t.muddat ?? t.boshlanish ?? t.createdAt;
    const oyda = sana >= from && sana < to;
    if (oyda && t.holat !== "BEKOR") {
      m.jami += 1;
      if (t.holat === "BAJARILDI") m.bajarildi += 1;
    }
    // Kechikkan: muddati o'tgan ochiq vazifa — oy filtrisiz (doim ko'rinsin).
    if (t.muddat && t.muddat < bugun && t.holat !== "BAJARILDI" && t.holat !== "BEKOR") {
      m.kechikkan += 1;
    }
    jam.set(id, m);
  }
  return jam;
}

/** Plan turiga mos natijani tanlaydi. */
function natijaTanla(
  planTuri: PlanTuri,
  stat: UserOyStat | undefined,
  vazifa: VazifaStatDTO | undefined,
  bajarilganVazifa: number
): number {
  switch (planTuri) {
    case "zakaz":
      return stat?.zakazlar ?? 0;
    case "savdo":
      return stat?.savdo ?? 0;
    case "kirim":
      return stat?.kirim ?? 0;
    case "vazifa":
      return bajarilganVazifa;
  }
}

/** Oy ichida BAJARILGAN vazifalar (bajarildiAt bo'yicha) — plan "vazifa" manbai. */
async function bajarilganVazifalar(businessId: string, oy: string): Promise<Map<string, number>> {
  const { from, to } = monthRangeUTC(oy);
  const rows = await prisma.task.groupBy({
    by: ["employeeId"],
    where: {
      businessId,
      deletedAt: null,
      employeeId: { not: null },
      holat: "BAJARILDI",
      bajarildiAt: { gte: from, lt: to },
    },
    _count: { _all: true },
  });
  return new Map(rows.filter((r) => r.employeeId).map((r) => [r.employeeId!, r._count._all]));
}

/**
 * Barcha xodimlar bo'yicha oy samaradorligi — kartochkalar, dashboard va
 * reyting bitta chaqiriqda (sahifa bitta payload oladi).
 */
export async function getXodimlarPerformance(
  businessId: string,
  oy: string
): Promise<XodimlarPerformanceDTO> {
  const bugun = new Date();
  const bugunKun = new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), bugun.getUTCDate()));

  const [xodimlar, planlar, statlar, vazifalar, bajarilgan, bugungiTatil] = await Promise.all([
    prisma.employee.findMany({
      where: { businessId, deletedAt: null },
      orderBy: [{ isActive: "desc" }, { ism: "asc" }],
      select: {
        id: true,
        ism: true,
        lavozim: true,
        rasmUrl: true,
        isActive: true,
        userId: true,
      },
    }),
    prisma.employeePlan.findMany({ where: { businessId, oy } }),
    userOyStatlari(businessId, oy),
    vazifaOyStatlari(businessId, oy, bugunKun),
    bajarilganVazifalar(businessId, oy),
    prisma.attendance.findMany({
      where: { businessId, sana: bugunKun, holat: "tatil" },
      select: { employeeId: true },
    }),
  ]);

  const planMap = new Map(planlar.map((p) => [p.employeeId, p]));
  const tatilda = new Set(bugungiTatil.map((a) => a.employeeId));

  const items: XodimPerformanceDTO[] = xodimlar.map((x) => {
    const p = planMap.get(x.id);
    const stat = x.userId ? statlar.get(x.userId) : undefined;
    const vazifa = vazifalar.get(x.id) ?? { jami: 0, bajarildi: 0, kechikkan: 0 };
    const bajarilganSoni = bajarilgan.get(x.id) ?? 0;

    let plan: PlanDTO | null = null;
    if (p) {
      const natija = natijaTanla(p.planTuri as PlanTuri, stat, vazifa, bajarilganSoni);
      plan = {
        id: p.id,
        oy: p.oy,
        planTuri: p.planTuri as PlanTuri,
        maqsad: p.maqsad,
        natija,
        foiz: foizHisobla(natija, p.maqsad),
        izoh: p.izoh,
      };
    }

    return {
      id: x.id,
      ism: x.ism,
      lavozim: x.lavozim,
      rasmUrl: x.rasmUrl,
      isActive: x.isActive,
      holat: !x.isActive ? "ketgan" : tatilda.has(x.id) ? "tatil" : "faol",
      userId: x.userId,
      plan,
      zakazlar: stat?.zakazlar ?? 0,
      savdo: stat?.savdo ?? 0,
      vazifa,
    };
  });

  const planlilar = items.filter((i) => i.isActive && i.plan);
  const engYaxshi = [...planlilar].sort((a, b) => b.plan!.foiz - a.plan!.foiz)[0] ?? null;

  const dashboard: PerformanceDashboardDTO = {
    faolXodim: items.filter((i) => i.isActive).length,
    ortachaFoiz:
      planlilar.length > 0
        ? Math.round(planlilar.reduce((s, i) => s + i.plan!.foiz, 0) / planlilar.length)
        : null,
    bajarganlar: planlilar.filter((i) => i.plan!.foiz >= 100).length,
    ortda: planlilar.filter((i) => i.plan!.foiz < 100).length,
    engYaxshi: engYaxshi
      ? { id: engYaxshi.id, ism: engYaxshi.ism, foiz: engYaxshi.plan!.foiz }
      : null,
  };

  return { oy, dashboard, xodimlar: items };
}

/**
 * Bitta xodimning plan TARIXI — mavjud plan yozuvlari, har biri o'z oyi
 * oralig'ida hisoblangan natija bilan (oxirgi 12 ta).
 */
export async function getXodimPlanTarixi(
  businessId: string,
  employeeId: string
): Promise<PlanDTO[]> {
  const planlar = await prisma.employeePlan.findMany({
    where: { businessId, employeeId },
    orderBy: { oy: "desc" },
    take: 12,
  });
  if (planlar.length === 0) return [];

  const xodim = await prisma.employee.findFirst({
    where: { id: employeeId, businessId },
    select: { userId: true },
  });

  const natijalar: PlanDTO[] = [];
  for (const p of planlar) {
    const turi = p.planTuri as PlanTuri;
    let natija = 0;
    if (turi === "vazifa") {
      const m = await bajarilganVazifalar(businessId, p.oy);
      natija = m.get(employeeId) ?? 0;
    } else if (xodim?.userId) {
      const statlar = await userOyStatlari(businessId, p.oy);
      const s = statlar.get(xodim.userId);
      natija = natijaTanla(turi, s, undefined, 0);
    }
    natijalar.push({
      id: p.id,
      oy: p.oy,
      planTuri: turi,
      maqsad: p.maqsad,
      natija,
      foiz: foizHisobla(natija, p.maqsad),
      izoh: p.izoh,
    });
  }
  return natijalar;
}

export interface XodimZakazDTO {
  id: string;
  summa: number;
  sana: string;
  izoh: string | null;
  tolovTuri: string | null;
  kategoriya: string | null;
  /** CRM buyurtmasidan ko'chirilgan bo'lsa — nomi. */
  crmNomi: string | null;
}

/**
 * Xodimning oy ichidagi zakazlari (kirim tranzaksiyalari lentasi) — detail
 * sahifaning "Zakazlar" tabi. Biriktirish qoidasi statistika bilan bir xil
 * (`sotuvchiId ?? userId`), qarz to'lovlari chiqariladi.
 */
export async function getXodimZakazlari(
  businessId: string,
  userId: string,
  oy: string
): Promise<XodimZakazDTO[]> {
  const { from, to } = monthRangeUTC(oy);
  const tolovIdlar = await qarzTolovTxIdlari(businessId);

  const rows = await prisma.transaction.findMany({
    where: {
      businessId,
      turi: "kirim",
      deletedAt: null,
      sana: { gte: from, lt: to },
      OR: [{ sotuvchiId: userId }, { sotuvchiId: null, userId }],
    },
    select: {
      id: true,
      summa: true,
      sana: true,
      izoh: true,
      tolovTuri: true,
      category: { select: { nomi: true } },
      crmBuyurtma: { select: { nomi: true } },
    },
    orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return rows
    .filter((r) => !tolovIdlar.has(r.id))
    .map((r) => ({
      id: r.id,
      summa: r.summa,
      sana: r.sana.toISOString().slice(0, 10),
      izoh: r.izoh,
      tolovTuri: r.tolovTuri,
      kategoriya: r.category?.nomi ?? null,
      crmNomi: r.crmBuyurtma?.nomi ?? null,
    }));
}

export interface XodimOylikDTO {
  id: string;
  oy: string;
  hisoblangan: number;
  avans: number;
  tolanadigan: number;
  holat: string;
  tolanganSana: string | null;
}

/** Xodimning oylik vedomost tarixi — detail sahifaning "Oylik" tabi. */
export async function listXodimOyliklari(
  businessId: string,
  employeeId: string
): Promise<XodimOylikDTO[]> {
  const rows = await prisma.payroll.findMany({
    where: { businessId, employeeId },
    orderBy: { oy: "desc" },
    take: 12,
  });
  return rows.map((p) => ({
    id: p.id,
    oy: p.oy,
    hisoblangan: p.hisoblangan,
    avans: p.avans,
    tolanadigan: p.tolanadigan,
    holat: p.holat,
    tolanganSana: p.tolanganSana ? p.tolanganSana.toISOString().slice(0, 10) : null,
  }));
}

/**
 * Xodimning O'Z samaradorligi ("Davomatim" sahifasi). Xodim faqat o'z
 * ma'lumotini ko'radi — employee `userId` orqali serverda topiladi,
 * mijozdan id qabul qilinmaydi.
 */
export async function getMenPerformance(
  businessId: string,
  userId: string,
  oy: string
): Promise<XodimPerformanceDTO | null> {
  const xodim = await prisma.employee.findFirst({
    where: { businessId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!xodim) return null;
  const hammasi = await getXodimlarPerformance(businessId, oy);
  return hammasi.xodimlar.find((x) => x.id === xodim.id) ?? null;
}
