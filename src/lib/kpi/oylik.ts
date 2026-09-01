import { prisma } from "@/lib/prisma";
import {
  ballChegarasi,
  ballFoizi,
  ballHolati,
  jamiOylik,
  planBonusi,
  planFoizi,
  progressivSotuvBonusi,
  vazifaHaqi,
  type BallHolati,
  type BonusQatori,
} from "./hisob";
import { kpiSozlamasi, standartPlan, type KpiSozlamaDTO } from "./sozlama";
import { sotuvJamlari } from "./sotuv";

/**
 * OYLIK HISOBI — real vaqtda, manbadan.
 *
 * Oy tugashini KUTMAYDI: har o'qishda joriy sotuv, joriy ball va joriy plan
 * bo'yicha "bugungi holat" chiqadi (`yakuniy = false`, UI "Hozirgi hisob"
 * deb yozadi). Oy YOPILGANDA `KpiPayroll` snapshot'i o'qiladi va raqamlar
 * o'sha holicha muzlatiladi (`yakuniy = true`, "Yakuniy hisob") — keyin CRM
 * yoki zakaz o'zgarsa ham yopilgan oylik SILJIMAYDI.
 *
 * Shu sababli alohida "qayta hisoblash" (recalc) mexanizmi KERAK EMAS:
 * zakaz to'lansa, jarima yozilsa, vazifa biriktirilsa yoki plan o'zgarsa —
 * keyingi o'qishda hisob allaqachon yangi. Saqlangan oraliq yig'indi yo'q,
 * demak eskirib qoladigan yig'indi ham yo'q.
 *
 * N+1 YO'Q: barcha xodim uchun sotuv, biriktiruv va ball bittadan so'rovda
 * ko'tariladi (`hisoblaBarchasi`), keyin xotirada birlashtiriladi.
 */

export interface VazifaHisobi {
  taskId: string;
  nomi: string;
  izoh: string | null;
  oylikHaq: number;
  ball: number;
  /** Qo'llangan foiz, yuzdan bir aniqlikda (85% → 8500). */
  foiz: number;
  hisoblangan: number;
  /** Shu oyda yo'qotilgan ball (musbat son). */
  yoqotilgan: number;
}

export interface XodimOylikHisobi {
  employeeId: string;
  ism: string;
  lavozim: string | null;
  rasmUrl: string | null;
  isActive: boolean;
  /** Tizim hisobi — sotuv shunga bog'lanadi. Null bo'lsa sotuv 0 bo'ladi. */
  userId: string | null;
  oy: string;
  sotuv: number;
  zakazlar: number;
  plan: number;
  planFoizi: number;
  planBajarildi: boolean;
  vazifalar: VazifaHisobi[];
  vazifaHaqi: number;
  sotuvBonusi: number;
  bonusQatorlari: BonusQatori[];
  planBonusi: number;
  tuzatish: number;
  jami: number;
  /** Vazifalar bo'yicha o'rtacha ball — FAQAT ko'rsatish uchun (hisobda emas). */
  ortachaBall: number;
  ballHolati: BallHolati;
  /** "QORALAMA" | "HISOBLANDI" | "TASDIQLANDI" | "TOLANDI" */
  holat: string;
  /** Oy yopilganmi — raqamlar snapshotdan olindimi. */
  yakuniy: boolean;
  payrollId: string | null;
}

/** Ball yig'indisi kaliti: employeeId + "|" + taskId. */
function kalit(employeeId: string, taskId: string): string {
  return `${employeeId}|${taskId}`;
}

/**
 * Oy bo'yicha (xodim, vazifa) kesimidagi ball o'zgarishi yig'indisi.
 * Manfiy — jarimalar, musbat — qaytarishlar. BITTA agregat so'rov.
 */
async function ballYigindilari(
  businessId: string,
  oy: string,
  employeeId?: string
): Promise<Map<string, number>> {
  const rows = await prisma.kpiPointLog.groupBy({
    by: ["employeeId", "taskId"],
    where: { businessId, oy, ...(employeeId ? { employeeId } : {}) },
    _sum: { ball: true },
  });
  return new Map(rows.map((r) => [kalit(r.employeeId, r.taskId), r._sum.ball ?? 0]));
}

interface BiriktiruvQatori {
  employeeId: string;
  task: { id: string; nomi: string; izoh: string | null; oylikHaq: number };
}

/**
 * Bir xodimning bir oydagi vazifa haqlari.
 *
 * HAR VAZIFA O'Z BALLI bo'yicha alohida hisoblanadi. O'rtacha ball bilan
 * hisoblash ATAYLAB qilinmaydi: 100 va 60 ballli ikki vazifaning o'rtachasi
 * (80) ikkalasini ham noto'g'ri to'lardi — biri 110% ga, ikkinchisi 70% ga
 * loyiq edi.
 */
function vazifalarniHisobla(
  biriktiruvlar: BiriktiruvQatori[],
  ballar: Map<string, number>,
  s: KpiSozlamaDTO
): VazifaHisobi[] {
  return biriktiruvlar.map((b) => {
    const xom = s.boshlangichBall + (ballar.get(kalit(b.employeeId, b.task.id)) ?? 0);
    const ball = ballChegarasi(xom, s.boshlangichBall);
    const foiz = ballFoizi(ball, s.ballQoidalari);
    return {
      taskId: b.task.id,
      nomi: b.task.nomi,
      izoh: b.task.izoh,
      oylikHaq: b.task.oylikHaq,
      ball,
      foiz,
      hisoblangan: vazifaHaqi(b.task.oylikHaq, foiz),
      yoqotilgan: s.boshlangichBall - ball,
    };
  });
}

interface XodimXom {
  id: string;
  ism: string;
  lavozim: string | null;
  rasmUrl: string | null;
  isActive: boolean;
  userId: string | null;
}

/**
 * Yopilgan oy uchun bonus tafsiloti — FAQAT joriy sozlama snapshotdagi
 * jami bilan bir xil natija bersa. Aks holda bo'sh (yuqoridagi izohga qarang).
 */
function mosBreakdown(
  sotuv: number,
  snapshotBonusi: number,
  s: KpiSozlamaDTO
): BonusQatori[] {
  const qayta = progressivSotuvBonusi(sotuv, s.intervallar);
  return qayta.jami === snapshotBonusi ? qayta.qatorlar : [];
}

/** Snapshot yozuvidan DTO — yopilgan oy raqamlari MANBADAN QAYTA o'qilmaydi. */
function snapshotdan(
  x: XodimXom,
  oy: string,
  p: {
    id: string;
    sotuv: number;
    plan: number;
    vazifaHaqi: number;
    sotuvBonusi: number;
    planBonusi: number;
    tuzatish: number;
    jami: number;
    holat: string;
    qatorlar: Array<{ taskId: string | null; taskNomi: string; oylikHaq: number; ball: number; foiz: number; hisoblangan: number }>;
  },
  s: KpiSozlamaDTO,
  zakazlar: number
): XodimOylikHisobi {
  const vazifalar: VazifaHisobi[] = p.qatorlar.map((q) => ({
    taskId: q.taskId ?? "",
    nomi: q.taskNomi,
    izoh: null,
    oylikHaq: q.oylikHaq,
    ball: q.ball,
    foiz: q.foiz,
    hisoblangan: q.hisoblangan,
    yoqotilgan: s.boshlangichBall - q.ball,
  }));
  const ortacha = vazifalar.length
    ? Math.round(vazifalar.reduce((a, v) => a + v.ball, 0) / vazifalar.length)
    : s.boshlangichBall;

  return {
    employeeId: x.id,
    ism: x.ism,
    lavozim: x.lavozim,
    rasmUrl: x.rasmUrl,
    isActive: x.isActive,
    userId: x.userId,
    oy,
    sotuv: p.sotuv,
    zakazlar,
    plan: p.plan,
    planFoizi: planFoizi(p.sotuv, p.plan),
    planBajarildi: p.plan > 0 && p.sotuv >= p.plan,
    vazifalar,
    vazifaHaqi: p.vazifaHaqi,
    sotuvBonusi: p.sotuvBonusi,
    // BREAKDOWN FAQAT MOS KELSA KO'RSATILADI. Qatorlar joriy sozlamadan
    // qayta chiziladi, snapshotdagi JAMI esa o'sha paytdagi sozlama bo'yicha
    // muzlatilgan. Agar oradan keyin foizlar o'zgargan bo'lsa, qatorlar
    // yig'indisi jami bilan TO'G'RI KELMAY qolardi va ekranda o'ziga o'zi
    // qarshi hisob ko'rinardi. Bunday holatda qatorlar umuman berilmaydi —
    // UI "yopilgan oy, o'sha paytdagi sozlama bo'yicha" deb tushuntiradi.
    bonusQatorlari: mosBreakdown(p.sotuv, p.sotuvBonusi, s),
    planBonusi: p.planBonusi,
    tuzatish: p.tuzatish,
    jami: p.jami,
    ortachaBall: ortacha,
    ballHolati: ballHolati(ortacha),
    holat: p.holat,
    yakuniy: true,
    payrollId: p.id,
  };
}

/**
 * BARCHA xodimlarning bir oylik hisobi — dashboard va reyting uchun.
 * So'rovlar soni SOBIT (xodimlar soniga bog'liq emas).
 */
export async function hisoblaBarchasi(
  businessId: string,
  oy: string
): Promise<{ sozlama: KpiSozlamaDTO; xodimlar: XodimOylikHisobi[] }> {
  const sozlama = await kpiSozlamasi(businessId);

  const [xodimlar, biriktiruvlar, ballar, sotuvlar, planlar, snapshotlar] = await Promise.all([
    prisma.employee.findMany({
      where: { businessId, deletedAt: null },
      orderBy: [{ isActive: "desc" }, { ism: "asc" }],
      select: { id: true, ism: true, lavozim: true, rasmUrl: true, isActive: true, userId: true },
    }),
    prisma.kpiTaskAssignment.findMany({
      where: { businessId, aktiv: true, task: { aktiv: true, deletedAt: null } },
      select: {
        employeeId: true,
        task: { select: { id: true, nomi: true, izoh: true, oylikHaq: true } },
      },
      orderBy: { task: { tartib: "asc" } },
    }),
    ballYigindilari(businessId, oy),
    sotuvJamlari(businessId, oy),
    prisma.kpiSalesTarget.findMany({ where: { businessId, oy } }),
    prisma.kpiPayroll.findMany({
      where: { businessId, oy },
      include: { qatorlar: true },
    }),
  ]);

  const biriktiruvMap = new Map<string, BiriktiruvQatori[]>();
  for (const b of biriktiruvlar) {
    const ro = biriktiruvMap.get(b.employeeId) ?? [];
    ro.push(b);
    biriktiruvMap.set(b.employeeId, ro);
  }
  const planMap = new Map(planlar.map((p) => [p.employeeId, p]));
  const snapshotMap = new Map(snapshotlar.map((p) => [p.employeeId, p]));
  const standart = standartPlan(oy, sozlama);

  const natija = xodimlar.map((x) => {
    const sotuvStat = x.userId ? sotuvlar.get(x.userId) : undefined;
    const zakazlar = sotuvStat?.zakazlar ?? 0;

    const snap = snapshotMap.get(x.id);
    if (snap) return snapshotdan(x, oy, snap, sozlama, zakazlar);

    const sotuv = sotuvStat?.summa ?? 0;
    const target = planMap.get(x.id);
    const plan = target?.maqsad ?? standart;
    const bonusSummasi = target?.planBonus ?? sozlama.planBonus;

    const vazifalar = vazifalarniHisobla(biriktiruvMap.get(x.id) ?? [], ballar, sozlama);
    const vazifaJami = vazifalar.reduce((a, v) => a + v.hisoblangan, 0);
    const bonus = progressivSotuvBonusi(sotuv, sozlama.intervallar);
    const planB = planBonusi(sotuv, plan, bonusSummasi);
    const ortacha = vazifalar.length
      ? Math.round(vazifalar.reduce((a, v) => a + v.ball, 0) / vazifalar.length)
      : sozlama.boshlangichBall;

    return {
      employeeId: x.id,
      ism: x.ism,
      lavozim: x.lavozim,
      rasmUrl: x.rasmUrl,
      isActive: x.isActive,
      userId: x.userId,
      oy,
      sotuv,
      zakazlar,
      plan,
      planFoizi: planFoizi(sotuv, plan),
      planBajarildi: plan > 0 && sotuv >= plan,
      vazifalar,
      vazifaHaqi: vazifaJami,
      sotuvBonusi: bonus.jami,
      bonusQatorlari: bonus.qatorlar,
      planBonusi: planB,
      tuzatish: 0,
      jami: jamiOylik({ vazifaHaqi: vazifaJami, sotuvBonusi: bonus.jami, planBonusi: planB }),
      ortachaBall: ortacha,
      ballHolati: ballHolati(ortacha),
      holat: "QORALAMA",
      yakuniy: false,
      payrollId: null,
    } satisfies XodimOylikHisobi;
  });

  return { sozlama, xodimlar: natija };
}

/** Bitta xodimning hisobi. Topilmasa null (begona xodim ham shu yo'l bilan kesiladi). */
export async function hisoblaXodim(
  businessId: string,
  employeeId: string,
  oy: string
): Promise<{ sozlama: KpiSozlamaDTO; hisob: XodimOylikHisobi } | null> {
  const { sozlama, xodimlar } = await hisoblaBarchasi(businessId, oy);
  const hisob = xodimlar.find((x) => x.employeeId === employeeId);
  return hisob ? { sozlama, hisob } : null;
}
