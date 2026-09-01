import { prisma } from "@/lib/prisma";
import {
  dateOnlyStringToUTCDate,
  utcDateToDateOnlyString,
  todayTashkentDateOnlyString,
} from "@/lib/date";
import { zakazUstuni, kirimUlushi } from "@/lib/crm/pipeline";
import { getXodimlarPerformance, type PlanDTO } from "@/lib/queries/xodimPlan";
import type { Prisma } from "@prisma/client";

/**
 * XODIM KATEGORIYASI ANALITIKASI — CRM zakazlari kesimida.
 *
 * HAQIQAT MANBAI: CRM buyurtmalari + zakaz-xodim biriktiruvlari (DealEmployee)
 * + bosqich turi (WON/LOST). Hech qanday hisoblagich saqlanmaydi — har
 * o'qishda manbadan hisoblanadi, statistika real CRM ma'lumotidan siljimaydi.
 *
 * MOLIYA BILAN ALOQA: "summa" — YUTILGAN buyurtmalarning CRM summasi.
 * Pulning o'zi mavjud CRM→Kirim ko'prigi orqali BIR marta yoziladi
 * (Deal.transactionId UNIQUE) — bu modul hech narsa yozmaydi.
 *
 * DAVR: buyurtmaning `sana` maydoni bo'yicha (kiritilmagan eski buyurtmalarda
 * `createdAt`) — CRM statistikasi bilan bir xil o'qish.
 */

export interface KategoriyaTabDTO {
  id: string;
  nomi: string;
  turi: string;
  azoSoni: number;
}

export interface KategoriyaXodimStatDTO {
  employeeId: string;
  ism: string;
  rasmUrl: string | null;
  isActive: boolean;
  /** Hozirgi a'zomi (tarixiy qatnashuvchi a'zolikdan chiqarilgan bo'lishi mumkin). */
  azo: boolean;
  /** Davrdagi zakazlar (qatnashgan) — "olingan zakazlar". */
  jami: number;
  /** Olingan zakazlarning umumiy summasi (so'm). */
  jamiSumma: number;
  yutilgan: number;
  yutqazilgan: number;
  ochiq: number;
  /** Yo'qotilgan zakazlar summasi (so'm). */
  yutqazilganSumma: number;
  /** Bugungi (zakaz sanasi = bugun, hali yakunlanmagan) zakazlar. */
  bugungi: number;
  bugungiSumma: number;
  /** Jarayondagi zakazlar. */
  jarayonda: number;
  jarayondaSumma: number;
  /** YUTILGAN zakazlar summasi (so'm). Ijrochi uchun — "qatnashgan zakazlar tushumi". */
  summa: number;
  /**
   * TO'LIQ PULI KELGAN SOTUV: yutilgan zakazlardan HAQIQATDA olingan pul
   * (`Deal.tolangan`, summadan oshmaydi). Bonus hisobi shu raqamga tayanadi —
   * qarzga ketgan sotuv bonusga kirmasin.
   */
  tolanganSotuv: number;
  /** O'rtacha yutilgan zakaz (so'm). */
  ortacha: number;
  /** Konversiya: yutilgan / jami, % (butun). */
  konversiya: number;
  /** Davr oxiri oyining plani (mavjud EmployeePlan dvigateli bilan hisoblangan). */
  plan: PlanDTO | null;
  /** Reyting o'rni (1 dan boshlab). */
  orin: number;
}

export interface KategoriyaKpiDTO {
  /** Sotuvchi KPI: yutilgan zakazlar summasi. */
  jamiSotuv: number;
  /**
   * BONUSGA TUSHADIGAN SOTUV: yutilgan zakazlardan haqiqatda olingan pul.
   * Qarzga ketgan qism bu raqamga KIRMAYDI — bonus faqat kelgan pul
   * ustidan hisoblansin.
   */
  tolanganSotuv: number;
  jamiZakaz: number;
  yutilganZakaz: number;
  /** Yutilgan / jami, % (butun). */
  konversiya: number;
  /** Ijrochi KPI: faol a'zolar soni. */
  faolXodim: number;
  /** Ijrochi KPI: bajarilgan ishga ega xodimlar bo'yicha o'rtacha zakaz. */
  ortachaZakaz: number;
  engYaxshi: { employeeId: string; ism: string } | null;
}

export interface KategoriyaAnalitikaDTO {
  kategoriya: { id: string; nomi: string; turi: string; aktiv: boolean };
  davr: { from: string; to: string };
  /** Plan hisoblangan oy ("YYYY-MM" — davr oxiri oyi). */
  oy: string;
  kpi: KategoriyaKpiDTO;
  xodimlar: KategoriyaXodimStatDTO[];
}

/** Davr sharti: buyurtma sanasi (bo'lmasa createdAt) from..to (inclusive). */
function dealDavrWhere(from: string, to: string): Prisma.DealWhereInput {
  const gte = dateOnlyStringToUTCDate(from);
  const lt = new Date(dateOnlyStringToUTCDate(to).getTime() + 24 * 60 * 60 * 1000);
  return {
    OR: [
      { sana: { gte, lt } },
      { sana: null, createdAt: { gte, lt } },
    ],
  };
}

/** Faol kategoriyalar (tablar uchun) — faol a'zolar soni bilan. */
export async function listKategoriyaTablari(businessId: string): Promise<KategoriyaTabDTO[]> {
  const rows = await prisma.employeeCategory.findMany({
    where: { businessId, aktiv: true },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
    include: {
      azolar: { select: { employee: { select: { isActive: true, deletedAt: true } } } },
    },
  });
  return rows.map((k) => ({
    id: k.id,
    nomi: k.nomi,
    turi: k.turi,
    azoSoni: k.azolar.filter((a) => a.employee.isActive && !a.employee.deletedAt).length,
  }));
}

interface XodimJam {
  jami: number;
  jamiSumma: number;
  yutilgan: number;
  yutqazilgan: number;
  yutqazilganSumma: number;
  ochiq: number;
  bugungi: number;
  bugungiSumma: number;
  jarayonda: number;
  jarayondaSumma: number;
  summa: number;
  tolanganSotuv: number;
}

const BOSH_JAM: XodimJam = {
  jami: 0,
  jamiSumma: 0,
  yutilgan: 0,
  yutqazilgan: 0,
  yutqazilganSumma: 0,
  ochiq: 0,
  bugungi: 0,
  bugungiSumma: 0,
  jarayonda: 0,
  jarayondaSumma: 0,
  summa: 0,
  tolanganSotuv: 0,
};

/**
 * BITTA ZAKAZNI XODIM JAMLARIGA QO'SHISH.
 *
 * Kesim CRM doskasi bilan AYNI qoidadan chiqadi (`lib/crm/pipeline.ts`):
 * "bugungi" va "jarayonda" bazada saqlanmaydi, ular `holat` + `sana` dan
 * hisoblanadi. Shunda statistika doskadagi ustun sarlavhalari bilan
 * bir xil raqam beradi.
 */
function jamgaQosh(
  m: XodimJam,
  deal: { holat: string; summa: number; tolangan: number; sana: Date | null },
  bugun: string
): XodimJam {
  m.jami += 1;
  m.jamiSumma += deal.summa;
  const ustun = zakazUstuni(deal.holat, deal.sana ? utcDateToDateOnlyString(deal.sana) : null, bugun);
  if (ustun === "YUTILDI") {
    m.yutilgan += 1;
    m.summa += deal.summa;
    m.tolanganSotuv += kirimUlushi(deal.summa, deal.tolangan);
  } else if (ustun === "YOQOTILDI") {
    m.yutqazilgan += 1;
    m.yutqazilganSumma += deal.summa;
  } else {
    m.ochiq += 1;
    if (ustun === "BUGUNGI") {
      m.bugungi += 1;
      m.bugungiSumma += deal.summa;
    } else if (ustun === "JARAYONDA") {
      m.jarayonda += 1;
      m.jarayondaSumma += deal.summa;
    }
  }
  return m;
}

/**
 * Bitta kategoriya bo'yicha davr analitikasi: KPI + xodim reytingi + plan.
 * A'zolikdan chiqarilgan, lekin davrda qatnashgan xodim ham ko'rinadi —
 * tarix yo'qolmaydi.
 */
export async function getKategoriyaAnalitika(params: {
  businessId: string;
  categoryId: string;
  from: string;
  to: string;
}): Promise<KategoriyaAnalitikaDTO | null> {
  const { businessId, categoryId, from, to } = params;

  const kategoriya = await prisma.employeeCategory.findFirst({
    where: { id: categoryId, businessId },
    select: { id: true, nomi: true, turi: true, aktiv: true },
  });
  if (!kategoriya) return null;

  const oy = to.slice(0, 7);

  const [azolar, qatnashuvlar, performance] = await Promise.all([
    prisma.employeeCategoryMember.findMany({
      where: { businessId, categoryId, employee: { deletedAt: null } },
      select: {
        employee: { select: { id: true, ism: true, rasmUrl: true, isActive: true } },
      },
    }),
    prisma.dealEmployee.findMany({
      where: { businessId, categoryId, deal: { deletedAt: null, ...dealDavrWhere(from, to) } },
      select: {
        employeeId: true,
        employee: { select: { id: true, ism: true, rasmUrl: true, isActive: true } },
        deal: { select: { summa: true, tolangan: true, holat: true, sana: true } },
      },
    }),
    // Plan — mavjud xodim-plan dvigateli (HR sahifasi bilan BIR XIL hisob,
    // ikkita haqiqat bo'lmasin).
    getXodimlarPerformance(businessId, oy),
  ]);

  const planMap = new Map(performance.xodimlar.map((x) => [x.id, x.plan]));

  // Xodimlar to'plami: hozirgi a'zolar + davrda qatnashganlar (tarix).
  const xodimInfo = new Map<
    string,
    { ism: string; rasmUrl: string | null; isActive: boolean; azo: boolean }
  >();
  for (const a of azolar) {
    xodimInfo.set(a.employee.id, {
      ism: a.employee.ism,
      rasmUrl: a.employee.rasmUrl,
      isActive: a.employee.isActive,
      azo: true,
    });
  }
  for (const q of qatnashuvlar) {
    if (!xodimInfo.has(q.employeeId)) {
      xodimInfo.set(q.employeeId, {
        ism: q.employee.ism,
        rasmUrl: q.employee.rasmUrl,
        isActive: q.employee.isActive,
        azo: false,
      });
    }
  }

  const bugun = todayTashkentDateOnlyString();
  const jamlar = new Map<string, XodimJam>();
  for (const q of qatnashuvlar) {
    const m = jamlar.get(q.employeeId) ?? { ...BOSH_JAM };
    jamlar.set(q.employeeId, jamgaQosh(m, q.deal, bugun));
  }

  const sotuvchimi = kategoriya.turi === "sotuvchi";

  const qatorlar = [...xodimInfo.entries()].map(([employeeId, info]) => {
    const m = jamlar.get(employeeId) ?? BOSH_JAM;
    return {
      employeeId,
      ism: info.ism,
      rasmUrl: info.rasmUrl,
      isActive: info.isActive,
      azo: info.azo,
      jami: m.jami,
      jamiSumma: m.jamiSumma,
      yutilgan: m.yutilgan,
      yutqazilgan: m.yutqazilgan,
      yutqazilganSumma: m.yutqazilganSumma,
      ochiq: m.ochiq,
      bugungi: m.bugungi,
      bugungiSumma: m.bugungiSumma,
      jarayonda: m.jarayonda,
      jarayondaSumma: m.jarayondaSumma,
      summa: m.summa,
      tolanganSotuv: m.tolanganSotuv,
      ortacha: m.yutilgan > 0 ? Math.round(m.summa / m.yutilgan) : 0,
      konversiya: m.jami > 0 ? Math.round((m.yutilgan / m.jami) * 100) : 0,
      plan: planMap.get(employeeId) ?? null,
      orin: 0,
    };
  });

  // REYTING: sotuvchi — yutilgan summa, teng bo'lsa yutilgan soni;
  // ijrochi — bajarilgan (yutilgan) soni, teng bo'lsa jami qatnashuv.
  qatorlar.sort((a, b) =>
    sotuvchimi
      ? b.summa - a.summa || b.yutilgan - a.yutilgan || b.jami - a.jami || a.ism.localeCompare(b.ism)
      : b.yutilgan - a.yutilgan || b.jami - a.jami || b.summa - a.summa || a.ism.localeCompare(b.ism)
  );
  qatorlar.forEach((q, i) => (q.orin = i + 1));

  const jamiZakaz = qatorlar.reduce((s, q) => s + q.jami, 0);
  const yutilganZakaz = qatorlar.reduce((s, q) => s + q.yutilgan, 0);
  const jamiSotuv = qatorlar.reduce((s, q) => s + q.summa, 0);
  const qatnashganlar = qatorlar.filter((q) => q.jami > 0).length;
  const birinchi = qatorlar.find((q) => (sotuvchimi ? q.summa > 0 || q.yutilgan > 0 : q.yutilgan > 0));

  const kpi: KategoriyaKpiDTO = {
    jamiSotuv,
    tolanganSotuv: qatorlar.reduce((s2, q) => s2 + q.tolanganSotuv, 0),
    jamiZakaz,
    yutilganZakaz,
    konversiya: jamiZakaz > 0 ? Math.round((yutilganZakaz / jamiZakaz) * 100) : 0,
    faolXodim: qatorlar.filter((q) => q.azo && q.isActive).length,
    ortachaZakaz: qatnashganlar > 0 ? Math.round(yutilganZakaz / qatnashganlar) : 0,
    engYaxshi: birinchi ? { employeeId: birinchi.employeeId, ism: birinchi.ism } : null,
  };

  return {
    kategoriya,
    davr: { from, to },
    oy,
    kpi,
    xodimlar: qatorlar,
  };
}

export interface XodimZakazQatoriDTO {
  dealId: string;
  nomi: string;
  mijoz: string | null;
  summa: number;
  /** "YYYY-MM-DD" (sana bo'lmasa createdAt kuni). */
  sana: string;
  /** Doska ustuni: KUTILAYOTGAN | BUGUNGI | JARAYONDA | YUTILDI | YOQOTILDI. */
  ustun: string;
  stageNomi: string;
  stageTuri: string;
  kategoriyaNomi: string;
  /** Kirim yozilganmi (havola ko'rsatish uchun). */
  kirimBor: boolean;
}

export interface XodimKategoriyaDetalDTO {
  xodim: {
    id: string;
    ism: string;
    lavozim: string | null;
    rasmUrl: string | null;
    isActive: boolean;
    kategoriyalar: string[];
  };
  davr: { from: string; to: string };
  kategoriya: { id: string; nomi: string; turi: string } | null;
  stat: {
    jami: number;
    jamiSumma: number;
    yutilgan: number;
    yutqazilgan: number;
    yutqazilganSumma: number;
    ochiq: number;
    bugungi: number;
    bugungiSumma: number;
    jarayonda: number;
    jarayondaSumma: number;
    summa: number;
    /** To'liq puli kelgan sotuv (bonus hisobi shu raqamga tayanadi). */
    tolanganSotuv: number;
    ortacha: number;
    konversiya: number;
  };
  plan: PlanDTO | null;
  /** Kategoriya tanlangan bo'lsa — reytingdagi o'rin (aks holda null). */
  orin: number | null;
  zakazlar: XodimZakazQatoriDTO[];
}

/**
 * Bitta xodimning kategoriya kesimidagi tafsiloti: KPI, plan, reyting o'rni
 * va davrdagi CRM zakazlari lentasi. `categoryId` berilmasa — barcha
 * kategoriyalardagi qatnashuvlari.
 */
export async function getXodimKategoriyaDetal(params: {
  businessId: string;
  employeeId: string;
  from: string;
  to: string;
  categoryId?: string | null;
}): Promise<XodimKategoriyaDetalDTO | null> {
  const { businessId, employeeId, from, to } = params;

  const xodim = await prisma.employee.findFirst({
    where: { id: employeeId, businessId, deletedAt: null },
    select: {
      id: true,
      ism: true,
      lavozim: true,
      rasmUrl: true,
      isActive: true,
      kategoriyalar: { select: { category: { select: { id: true, nomi: true } } } },
    },
  });
  if (!xodim) return null;

  const where: Prisma.DealEmployeeWhereInput = {
    businessId,
    employeeId,
    deal: { deletedAt: null, ...dealDavrWhere(from, to) },
  };
  if (params.categoryId) where.categoryId = params.categoryId;

  const rows = await prisma.dealEmployee.findMany({
    where,
    select: {
      deal: {
        select: {
          id: true,
          nomi: true,
          summa: true,
          tolangan: true,
          holat: true,
          sana: true,
          createdAt: true,
          transactionId: true,
          contact: { select: { ism: true } },
          stage: { select: { nomi: true, turi: true } },
        },
      },
      category: { select: { nomi: true } },
    },
    orderBy: { deal: { createdAt: "desc" } },
    take: 300,
  });

  const bugunKuni = todayTashkentDateOnlyString();
  const jam = { ...BOSH_JAM };
  const zakazlar: XodimZakazQatoriDTO[] = rows.map((r) => {
    jamgaQosh(jam, r.deal, bugunKuni);
    const sana = r.deal.sana ? utcDateToDateOnlyString(r.deal.sana) : null;
    return {
      dealId: r.deal.id,
      nomi: r.deal.nomi,
      mijoz: r.deal.contact?.ism ?? null,
      summa: r.deal.summa,
      sana: sana ?? utcDateToDateOnlyString(r.deal.createdAt),
      ustun: zakazUstuni(r.deal.holat, sana, bugunKuni),
      stageNomi: r.deal.stage.nomi,
      stageTuri: r.deal.stage.turi,
      kategoriyaNomi: r.category.nomi,
      kirimBor: Boolean(r.deal.transactionId),
    };
  });
  const stat = {
    ...jam,
    ortacha: jam.yutilgan > 0 ? Math.round(jam.summa / jam.yutilgan) : 0,
    konversiya: jam.jami > 0 ? Math.round((jam.yutilgan / jam.jami) * 100) : 0,
  };

  // Sana bo'yicha teskari tartib (createdAt bo'yicha kelgan, sana ustunroq).
  zakazlar.sort((a, b) => b.sana.localeCompare(a.sana));

  // Plan va reyting o'rni — kategoriya konteksti bo'lsa o'sha reytingdan.
  let plan: PlanDTO | null = null;
  let orin: number | null = null;
  let kategoriya: { id: string; nomi: string; turi: string } | null = null;
  if (params.categoryId) {
    const analitika = await getKategoriyaAnalitika({ businessId, categoryId: params.categoryId, from, to });
    if (analitika) {
      kategoriya = {
        id: analitika.kategoriya.id,
        nomi: analitika.kategoriya.nomi,
        turi: analitika.kategoriya.turi,
      };
      const qator = analitika.xodimlar.find((x) => x.employeeId === employeeId);
      plan = qator?.plan ?? null;
      orin = qator?.orin ?? null;
    }
  } else {
    const performance = await getXodimlarPerformance(businessId, to.slice(0, 7));
    plan = performance.xodimlar.find((x) => x.id === employeeId)?.plan ?? null;
  }

  return {
    xodim: {
      id: xodim.id,
      ism: xodim.ism,
      lavozim: xodim.lavozim,
      rasmUrl: xodim.rasmUrl,
      isActive: xodim.isActive,
      kategoriyalar: xodim.kategoriyalar.map((k) => k.category.nomi),
    },
    davr: { from, to },
    kategoriya,
    stat,
    plan,
    orin,
    zakazlar,
  };
}
