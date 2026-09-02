import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { ortachaBahoHisobla } from "@/lib/queries/kategoriyaAnalitika";

/**
 * XODIM KARTOCHKALARI UCHUN LAVOZIM KESIMIDAGI KPI — barcha xodimlar,
 * BITTA davr, IKKI so'rov (a'zoliklar + biriktiruvlar). Xodim boshiga
 * alohida so'rov YO'Q (39-talab).
 *
 * HAQIQAT MANBAI: `DealEmployee` (qatnashuv) + `Deal.holat`. Hisoblagich
 * saqlanmaydi — zakaz tahrirlansa yoki xodim almashtirilsa raqam o'z-o'zidan
 * to'g'rilanadi (26/28-talab).
 *
 * KPI LAVOZIM TURIGA QARAB (17-23-talab):
 *   sotuvchi — olingan / yutilgan / bekor / jami sotuv / o'rtacha chek;
 *   ijrochi  — zakazga chiqdi / bajarildi / bekor / o'rtacha baho.
 * Shofyor pul bilan baholanmaydi: `summa` ijrochi kartasida ko'rsatilmaydi.
 */

export interface LavozimKpiDTO {
  categoryId: string;
  nomi: string;
  turi: string;
  tartib: number;
  /** Davrdagi qatnashuvlar (sotuvchi: olingan zakazlar). */
  jami: number;
  yutilgan: number;
  yoqotilgan: number;
  /** Yutilgan zakazlar summasi (so'm) — faqat sotuvchi turida ma'noli. */
  summa: number;
  ortachaBaho: number | null;
  bahoSoni: number;
}

export interface XodimJamoaKpiDTO {
  employeeId: string;
  /** Hozirgi lavozimlari (a'zolik) — tartib bo'yicha; birinchisi asosiy. */
  lavozimlar: { categoryId: string; nomi: string; turi: string }[];
  /** Lavozim kesimidagi davr KPI'si (qatnashgan yoki a'zo bo'lgan lavozimlar). */
  kpi: LavozimKpiDTO[];
}

interface Jam {
  jami: number;
  yutilgan: number;
  yoqotilgan: number;
  summa: number;
  bahoYigindi: number;
  bahoSoni: number;
}

const yangiJam = (): Jam => ({ jami: 0, yutilgan: 0, yoqotilgan: 0, summa: 0, bahoYigindi: 0, bahoSoni: 0 });

/**
 * Barcha xodimlar bo'yicha lavozim kesimi (kalit: Employee.id).
 * Davr — zakaz sanasi (bo'lmasa createdAt), from..to inclusive.
 */
export async function getXodimlarJamoaKpi(
  businessId: string,
  davr: { from: string; to: string }
): Promise<Map<string, XodimJamoaKpiDTO>> {
  const gte = dateOnlyStringToUTCDate(davr.from);
  const lt = new Date(dateOnlyStringToUTCDate(davr.to).getTime() + 24 * 60 * 60 * 1000);

  const [azoliklar, qatnashuvlar] = await Promise.all([
    prisma.employeeCategoryMember.findMany({
      where: { businessId, employee: { deletedAt: null }, category: { aktiv: true } },
      select: {
        employeeId: true,
        category: { select: { id: true, nomi: true, turi: true, tartib: true } },
      },
    }),
    prisma.dealEmployee.findMany({
      where: {
        businessId,
        deal: {
          deletedAt: null,
          OR: [{ sana: { gte, lt } }, { sana: null, createdAt: { gte, lt } }],
        },
      },
      select: {
        employeeId: true,
        baho: true,
        category: { select: { id: true, nomi: true, turi: true, tartib: true } },
        deal: { select: { holat: true, summa: true } },
      },
    }),
  ]);

  const natija = new Map<string, XodimJamoaKpiDTO>();
  const ol = (employeeId: string) => {
    let x = natija.get(employeeId);
    if (!x) {
      x = { employeeId, lavozimlar: [], kpi: [] };
      natija.set(employeeId, x);
    }
    return x;
  };
  const kpiOl = (x: XodimJamoaKpiDTO, k: { id: string; nomi: string; turi: string; tartib: number }) => {
    let row = x.kpi.find((r) => r.categoryId === k.id);
    if (!row) {
      row = {
        categoryId: k.id,
        nomi: k.nomi,
        turi: k.turi,
        tartib: k.tartib,
        jami: 0,
        yutilgan: 0,
        yoqotilgan: 0,
        summa: 0,
        ortachaBaho: null,
        bahoSoni: 0,
      };
      x.kpi.push(row);
    }
    return row;
  };

  for (const a of azoliklar) {
    const x = ol(a.employeeId);
    x.lavozimlar.push({ categoryId: a.category.id, nomi: a.category.nomi, turi: a.category.turi });
    kpiOl(x, a.category);
  }

  const jamlar = new Map<string, Jam>();
  for (const q of qatnashuvlar) {
    const x = ol(q.employeeId);
    kpiOl(x, q.category);
    const kalit = `${q.employeeId}:${q.category.id}`;
    const j = jamlar.get(kalit) ?? yangiJam();
    j.jami += 1;
    if (q.deal.holat === "YUTILDI") {
      j.yutilgan += 1;
      j.summa += q.deal.summa;
    } else if (q.deal.holat === "YOQOTILDI") {
      j.yoqotilgan += 1;
    }
    if (q.baho !== null) {
      j.bahoYigindi += q.baho;
      j.bahoSoni += 1;
    }
    jamlar.set(kalit, j);
  }

  for (const x of natija.values()) {
    // Lavozimlar tartibi — sozlangan tartib (Sotuvchi odatda birinchi).
    x.kpi.sort((a, b) => a.tartib - b.tartib || a.nomi.localeCompare(b.nomi));
    x.lavozimlar.sort((a, b) => {
      const ta = x.kpi.find((k) => k.categoryId === a.categoryId)?.tartib ?? 0;
      const tb = x.kpi.find((k) => k.categoryId === b.categoryId)?.tartib ?? 0;
      return ta - tb || a.nomi.localeCompare(b.nomi);
    });
    for (const row of x.kpi) {
      const j = jamlar.get(`${x.employeeId}:${row.categoryId}`);
      if (!j) continue;
      row.jami = j.jami;
      row.yutilgan = j.yutilgan;
      row.yoqotilgan = j.yoqotilgan;
      row.summa = j.summa;
      row.ortachaBaho = ortachaBahoHisobla(j.bahoYigindi, j.bahoSoni);
      row.bahoSoni = j.bahoSoni;
    }
  }
  return natija;
}
