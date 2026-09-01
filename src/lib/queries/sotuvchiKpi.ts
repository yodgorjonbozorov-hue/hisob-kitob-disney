import { prisma } from "@/lib/prisma";
import {
  dateOnlyStringToUTCDate,
  utcDateToDateOnlyString,
  todayTashkentDateOnlyString,
} from "@/lib/date";
import { getXodimlarPerformance, type PlanDTO } from "@/lib/queries/xodimPlan";
import { SOTUVCHI_TURI } from "@/lib/services/zakazSotuvchi";
import { tolovHisobla, type QarzQismi, type ZakazTolovHolati } from "@/lib/crm/tolovHolati";
import { zakazUstuni } from "@/lib/crm/pipeline";
import type { Prisma } from "@prisma/client";

/**
 * SOTUVCHI STATISTIKASI — CRM zakazlari kesimida (11-24-talablar).
 *
 * HAQIQAT MANBAI: CRM zakazlari + sotuvchi biriktiruvi (`DealEmployee`,
 * `EmployeeCategory.turi = "sotuvchi"`) + zakaz holati (`Deal.holat`,
 * `lib/crm/pipeline.ts` bilan AYNI qoida — doska va statistika bir xil
 * raqam bersin) + to'lov holati (`lib/crm/tolovHolati.ts`). Hech qanday
 * hisoblagich SAQLANMAYDI — har o'qishda manbadan hisoblanadi.
 *
 * IKKI SUMMA ARALASHTIRILMAYDI (16-talab):
 *   `yutilgan.summa`  — yopilgan sotuv qiymati (qarzga berilgani ham kiradi);
 *   `puliKelgan`      — HAQIQATDA kelib tushgan pul (faqat to'liq to'langan
 *                       zakazlar). Sotuvchi bonusi FAQAT shundan hisoblanadi.
 *
 * SAMARADORLIK (33-talab): butun davr UCHTA so'rovda o'qiladi (biriktiruvlar,
 * qarzlar, plan) — xodim boshiga alohida so'rov YO'Q.
 */

export interface SotuvchiJamDTO {
  soni: number;
  summa: number;
}

export interface SotuvchiKpiDTO {
  employeeId: string;
  ism: string;
  rasmUrl: string | null;
  isActive: boolean;
  /** Hozir ham sotuvchi kategoriyasining a'zosimi (tarixiy sotuvchi bo'lmasligi mumkin). */
  azo: boolean;
  /** Olingan zakazlar — davrdagi barcha (12-talab). */
  olingan: SotuvchiJamDTO;
  /** Yutilgan zakazlar (13-talab). */
  yutilgan: SotuvchiJamDTO;
  /** Yo'qotilgan zakazlar (14-talab). */
  yoqotilgan: SotuvchiJamDTO;
  /** Jarayondagi — hali yutilmagan va yo'qotilmagan (15-talab). */
  jarayonda: SotuvchiJamDTO;
  /** To'liq puli kelgan sotuv (16-talab) — bonus manbai. */
  puliKelgan: number;
  /** Qisman to'langan zakazlardan kelgan pul (18-talab, faqat ma'lumot uchun). */
  qismanTolangan: number;
  /** Yutilgan, lekin puli hali to'liq kelmagan summa (qarzdagi sotuv). */
  qarzdagi: number;
  /** Konversiya: WON / (WON + LOST) × 100 (19-talab). */
  konversiya: number;
  /** O'rtacha yutilgan zakaz (so'm). */
  ortacha: number;
  /** Bonus hisobiga uzatiladigan baza (32-talab) — `puliKelgan` bilan bir xil. */
  bonusAsosi: number;
  /** Davr oxiri oyining plani (mavjud EmployeePlan dvigateli). */
  plan: PlanDTO | null;
  /** Reyting o'rni (1 dan boshlab) — `puliKelgan` bo'yicha (23-talab). */
  orin: number;
}

export interface SotuvchilarKpiDTO {
  davr: { from: string; to: string };
  /** Plan hisoblangan oy ("YYYY-MM" — davr oxiri oyi). */
  oy: string;
  jami: {
    olingan: SotuvchiJamDTO;
    yutilgan: SotuvchiJamDTO;
    yoqotilgan: SotuvchiJamDTO;
    jarayonda: SotuvchiJamDTO;
    puliKelgan: number;
    konversiya: number;
  };
  sotuvchilar: SotuvchiKpiDTO[];
}

/**
 * KONVERSIYA — qayta ishlatiladigan sof funksiya (19-talab).
 * Jarayondagi zakazlar maxrajga KIRMAYDI: hali natijasi yo'q zakaz
 * sotuvchining konversiyasini yolg'on pasaytirmasin.
 */
export function konversiyaHisobla(yutilgan: number, yoqotilgan: number): number {
  const maxraj = yutilgan + yoqotilgan;
  return maxraj > 0 ? Math.round((yutilgan / maxraj) * 100) : 0;
}

/** Davr sharti: buyurtma sanasi (bo'lmasa createdAt) from..to (inclusive). */
function dealDavrWhere(from: string, to: string): Prisma.DealWhereInput {
  const gte = dateOnlyStringToUTCDate(from);
  const lt = new Date(dateOnlyStringToUTCDate(to).getTime() + 24 * 60 * 60 * 1000);
  return { OR: [{ sana: { gte, lt } }, { sana: null, createdAt: { gte, lt } }] };
}

const BOSH: Omit<SotuvchiKpiDTO, "employeeId" | "ism" | "rasmUrl" | "isActive" | "azo" | "plan" | "orin"> = {
  olingan: { soni: 0, summa: 0 },
  yutilgan: { soni: 0, summa: 0 },
  yoqotilgan: { soni: 0, summa: 0 },
  jarayonda: { soni: 0, summa: 0 },
  puliKelgan: 0,
  qismanTolangan: 0,
  qarzdagi: 0,
  konversiya: 0,
  ortacha: 0,
  bonusAsosi: 0,
};

const yangiJam = () => ({
  olingan: { soni: 0, summa: 0 },
  yutilgan: { soni: 0, summa: 0 },
  yoqotilgan: { soni: 0, summa: 0 },
  jarayonda: { soni: 0, summa: 0 },
  puliKelgan: 0,
  qismanTolangan: 0,
  qarzdagi: 0,
});

type Jam = ReturnType<typeof yangiJam>;

interface BiriktiruvQator {
  employeeId: string;
  employee: { id: string; ism: string; rasmUrl: string | null; isActive: boolean };
  deal: {
    id: string;
    nomi: string;
    summa: number;
    tolangan: number;
    holat: string;
    debtId: string | null;
    sana: Date | null;
    createdAt: Date;
    contact: { ism: string | null } | null;
    debt: { jamiSumma: number; tolangan: number; status: string } | null;
    transaction: { id: string; summa: number; tolovTuri: string | null; deletedAt: Date | null } | null;
  };
}

/** Davrdagi sotuvchi biriktiruvlari + ularning qarz yozuvlari (2 so'rov). */
async function biriktiruvlarniOqi(params: {
  businessId: string;
  from: string;
  to: string;
  employeeId?: string | null;
}): Promise<{ qatorlar: BiriktiruvQator[]; qarzlar: Map<string, QarzQismi> }> {
  const where: Prisma.DealEmployeeWhereInput = {
    businessId: params.businessId,
    // Kategoriya keyin noaktiv qilingan bo'lsa ham tarix saqlanadi (30-talab).
    category: { turi: SOTUVCHI_TURI },
    // Bekor qilingan/o'chirilgan zakaz statistikaga KIRMAYDI (31-talab).
    deal: { deletedAt: null, ...dealDavrWhere(params.from, params.to) },
  };
  if (params.employeeId) where.employeeId = params.employeeId;

  const qatorlar = await prisma.dealEmployee.findMany({
    where,
    select: {
      employeeId: true,
      employee: { select: { id: true, ism: true, rasmUrl: true, isActive: true } },
      deal: {
        select: {
          id: true,
          nomi: true,
          summa: true,
          tolangan: true,
          holat: true,
          debtId: true,
          sana: true,
          createdAt: true,
          contact: { select: { ism: true } },
          debt: { select: { jamiSumma: true, tolangan: true, status: true } },
          transaction: { select: { id: true, summa: true, tolovTuri: true, deletedAt: true } },
        },
      },
    },
  });

  // ESKI (pipeline'gacha) zakazlar: qarz `manbaTransactionId` ko'prigi
  // orqali topiladi. Yangi zakazlarda qarz `Deal.debtId` bilan keladi.
  const qarzTxIdlar = qatorlar
    .filter((q) => !q.deal.debtId && q.deal.tolangan === 0)
    .map((q) => q.deal.transaction)
    .filter((t): t is NonNullable<typeof t> => Boolean(t && !t.deletedAt && t.tolovTuri === "qarz"))
    .map((t) => t.id);

  const qarzYozuvlar = qarzTxIdlar.length
    ? await prisma.debt.findMany({
        where: { businessId: params.businessId, manbaTransactionId: { in: [...new Set(qarzTxIdlar)] } },
        select: { manbaTransactionId: true, jamiSumma: true, tolangan: true, status: true },
      })
    : [];

  return {
    qatorlar,
    qarzlar: new Map(qarzYozuvlar.map((q) => [q.manbaTransactionId!, q])),
  };
}

/** Zakazning qarz yozuvi: yangi yo'lda `Deal.debt`, eskisida ko'prik orqali. */
function qarzTop(q: BiriktiruvQator, qarzlar: Map<string, QarzQismi>): QarzQismi | null {
  if (q.deal.debt) return q.deal.debt;
  return q.deal.transaction ? qarzlar.get(q.deal.transaction.id) ?? null : null;
}

/** Bitta biriktiruvni jamga qo'shadi (KPI qoidalari shu yerda, bitta joyda). */
function jamgaQosh(jam: Jam, q: BiriktiruvQator, qarzlar: Map<string, QarzQismi>): void {
  const d = q.deal;
  jam.olingan.soni += 1;
  jam.olingan.summa += d.summa;

  if (d.holat === "YUTILDI") {
    jam.yutilgan.soni += 1;
    jam.yutilgan.summa += d.summa;
    const tolov = tolovHisobla(d, qarzTop(q, qarzlar), d.transaction);
    jam.puliKelgan += tolov.puliKelgan;
    if (tolov.holati !== "TOLIQ") {
      jam.qismanTolangan += tolov.tolangan;
      jam.qarzdagi += d.summa;
    }
  } else if (d.holat === "YOQOTILDI") {
    jam.yoqotilgan.soni += 1;
    jam.yoqotilgan.summa += d.summa;
  } else {
    jam.jarayonda.soni += 1;
    jam.jarayonda.summa += d.summa;
  }
}

/**
 * SOTUVCHILAR REYTINGI VA KPI (20/23-talab). Reyting metrikasi — `puliKelgan`:
 * real pul kelmagan zakaz sotuvchini birinchi o'ringa chiqarmasin.
 */
export async function getSotuvchilarKpi(params: {
  businessId: string;
  from: string;
  to: string;
}): Promise<SotuvchilarKpiDTO> {
  const { businessId, from, to } = params;
  const oy = to.slice(0, 7);

  const [{ qatorlar, qarzlar }, azolar, performance] = await Promise.all([
    biriktiruvlarniOqi({ businessId, from, to }),
    prisma.employeeCategoryMember.findMany({
      where: { businessId, category: { turi: SOTUVCHI_TURI }, employee: { deletedAt: null } },
      select: { employee: { select: { id: true, ism: true, rasmUrl: true, isActive: true } } },
    }),
    // Plan — mavjud xodim-plan dvigateli (HR sahifasi bilan BIR XIL hisob).
    getXodimlarPerformance(businessId, oy),
  ]);

  const info = new Map<string, { ism: string; rasmUrl: string | null; isActive: boolean; azo: boolean }>();
  for (const a of azolar) {
    info.set(a.employee.id, { ...a.employee, azo: true });
  }
  for (const q of qatorlar) {
    if (!info.has(q.employeeId)) info.set(q.employeeId, { ...q.employee, azo: false });
  }

  const jamlar = new Map<string, Jam>();
  const umumiy = yangiJam();
  for (const q of qatorlar) {
    const jam = jamlar.get(q.employeeId) ?? yangiJam();
    jamgaQosh(jam, q, qarzlar);
    jamgaQosh(umumiy, q, qarzlar);
    jamlar.set(q.employeeId, jam);
  }

  const planMap = new Map(performance.xodimlar.map((x) => [x.id, x.plan]));

  const sotuvchilar: SotuvchiKpiDTO[] = [...info.entries()].map(([employeeId, x]) => {
    const jam = jamlar.get(employeeId);
    const baza = jam ?? BOSH;
    return {
      employeeId,
      ism: x.ism,
      rasmUrl: x.rasmUrl,
      isActive: x.isActive,
      azo: x.azo,
      olingan: { ...baza.olingan },
      yutilgan: { ...baza.yutilgan },
      yoqotilgan: { ...baza.yoqotilgan },
      jarayonda: { ...baza.jarayonda },
      puliKelgan: baza.puliKelgan,
      qismanTolangan: baza.qismanTolangan,
      qarzdagi: baza.qarzdagi,
      konversiya: konversiyaHisobla(baza.yutilgan.soni, baza.yoqotilgan.soni),
      ortacha: baza.yutilgan.soni > 0 ? Math.round(baza.yutilgan.summa / baza.yutilgan.soni) : 0,
      bonusAsosi: baza.puliKelgan,
      plan: planMap.get(employeeId) ?? null,
      orin: 0,
    };
  });

  sotuvchilar.sort(
    (a, b) =>
      b.puliKelgan - a.puliKelgan ||
      b.yutilgan.summa - a.yutilgan.summa ||
      b.yutilgan.soni - a.yutilgan.soni ||
      a.ism.localeCompare(b.ism)
  );
  sotuvchilar.forEach((s, i) => (s.orin = i + 1));

  return {
    davr: { from, to },
    oy,
    jami: {
      olingan: umumiy.olingan,
      yutilgan: umumiy.yutilgan,
      yoqotilgan: umumiy.yoqotilgan,
      jarayonda: umumiy.jarayonda,
      puliKelgan: umumiy.puliKelgan,
      konversiya: konversiyaHisobla(umumiy.yutilgan.soni, umumiy.yoqotilgan.soni),
    },
    sotuvchilar,
  };
}

export interface SotuvchiZakazDTO {
  dealId: string;
  nomi: string;
  mijoz: string | null;
  summa: number;
  /** "YYYY-MM-DD" (sana bo'lmasa createdAt kuni). */
  sana: string;
  /** Doska ustuni (`lib/crm/pipeline.ts` qoidasi bilan). */
  ustun: string;
  holat: string;
  tolovHolati: ZakazTolovHolati;
  /** Shu zakazdan kelib tushgan pul. */
  tolangan: number;
}

export interface SotuvchiDetalDTO {
  sotuvchi: { employeeId: string; ism: string; rasmUrl: string | null; isActive: boolean };
  davr: { from: string; to: string };
  oy: string;
  kpi: SotuvchiKpiDTO;
  zakazlar: SotuvchiZakazDTO[];
}

/**
 * BITTA SOTUVCHI TAFSILOTI (11/21/22-talab): KPI kartalari + davrdagi
 * zakazlar lentasi. Reyting o'rni umumiy ro'yxatdan olinadi.
 */
export async function getSotuvchiDetal(params: {
  businessId: string;
  employeeId: string;
  from: string;
  to: string;
}): Promise<SotuvchiDetalDTO | null> {
  const { businessId, employeeId, from, to } = params;

  const xodim = await prisma.employee.findFirst({
    where: { id: employeeId, businessId, deletedAt: null },
    select: { id: true, ism: true, rasmUrl: true, isActive: true },
  });
  if (!xodim) return null;

  const [{ qatorlar, qarzlar }, umumiy] = await Promise.all([
    biriktiruvlarniOqi({ businessId, from, to, employeeId }),
    getSotuvchilarKpi({ businessId, from, to }),
  ]);

  const kpi =
    umumiy.sotuvchilar.find((s) => s.employeeId === employeeId) ??
    ({
      employeeId,
      ism: xodim.ism,
      rasmUrl: xodim.rasmUrl,
      isActive: xodim.isActive,
      azo: false,
      ...BOSH,
      plan: null,
      orin: 0,
    } as SotuvchiKpiDTO);

  const bugun = todayTashkentDateOnlyString();
  const zakazlar: SotuvchiZakazDTO[] = qatorlar
    .map((q) => {
      const t = tolovHisobla(q.deal, qarzTop(q, qarzlar), q.deal.transaction);
      const sana = utcDateToDateOnlyString(q.deal.sana ?? q.deal.createdAt);
      return {
        dealId: q.deal.id,
        nomi: q.deal.nomi,
        mijoz: q.deal.contact?.ism ?? null,
        summa: q.deal.summa,
        sana,
        ustun: zakazUstuni(q.deal.holat, q.deal.sana ? sana : null, bugun),
        holat: q.deal.holat,
        tolovHolati: t.holati,
        tolangan: t.tolangan,
      };
    })
    .sort((a, b) => b.sana.localeCompare(a.sana))
    .slice(0, 300);

  return {
    sotuvchi: { employeeId: xodim.id, ism: xodim.ism, rasmUrl: xodim.rasmUrl, isActive: xodim.isActive },
    davr: { from, to },
    oy: to.slice(0, 7),
    kpi,
    zakazlar,
  };
}
