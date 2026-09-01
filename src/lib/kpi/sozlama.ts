import { prisma } from "@/lib/prisma";
import { runBusinessTx } from "@/lib/db/businessTx";
import { parseMonthString } from "@/lib/date";
import type { BonusIntervali, BallQoidasi } from "./hisob";

/**
 * KPI SOZLAMALARI — biznes o'z qoidasini o'zi belgilaydi.
 *
 * Quyidagi standart qiymatlar Disney Navoiy uchun kelishilgan qoida bo'lib,
 * ular KOD ICHIDA QOTIRILMAGAN: yangi biznes birinchi marta modulni ochganda
 * shu qiymatlar BAZAGA yoziladi va shundan keyin sozlamalar sahifasidan
 * o'zgartiriladi. Ya'ni bu "default", "hardcode" emas — boshqa biznes o'z
 * foizini, planini va ball jadvalini mustaqil yuritadi.
 */

/** Progressiv bonus: har interval o'z foizi bilan (foiz — yuzdan bir). */
export const STANDART_INTERVALLAR: BonusIntervali[] = [
  { dan: 0, gacha: 40_000_000, foiz: 200 },
  { dan: 40_000_000, gacha: 80_000_000, foiz: 300 },
  { dan: 80_000_000, gacha: 120_000_000, foiz: 400 },
  { dan: 120_000_000, gacha: null, foiz: 500 },
];

/** Ball → vazifa haqi foizi (chegaralar inclusive). */
export const STANDART_BALL_QOIDALARI: BallQoidasi[] = [
  { minBall: 100, maxBall: 100, foiz: 11_000 },
  { minBall: 85, maxBall: 99, foiz: 10_000 },
  { minBall: 70, maxBall: 84, foiz: 8_500 },
  { minBall: 55, maxBall: 69, foiz: 7_000 },
  { minBall: 40, maxBall: 54, foiz: 5_000 },
  { minBall: 0, maxBall: 39, foiz: 0 },
];

/** Standart vazifalar va ularning tayyor jarima sabablari. */
export const STANDART_VAZIFALAR: Array<{
  nomi: string;
  izoh: string;
  oylikHaq: number;
  presetlar: Array<{ sabab: string; ball: number; kritik?: boolean }>;
}> = [
  {
    nomi: "Mijoz bilan aloqa va qo'ng'iroqlar tahlili",
    izoh: "Kunlik qo'ng'iroqlar, hisobot va mijoz bilan aloqa sifati.",
    oylikHaq: 1_000_000,
    presetlar: [
      { sabab: "Kunlik hisobot guruhga tashlanmagan", ball: 4 },
      { sabab: "Hisobot to'liqsiz", ball: 2 },
      { sabab: "Qo'ng'iroq qilinmagan, lekin qilingan deb yozilgan", ball: 15, kritik: true },
    ],
  },
  {
    nomi: "Baza, hisob yuritish va ertalabki e'lon",
    izoh: "CRM va Balansaga kiritish, ertalabki ro'yxat, summalar aniqligi.",
    oylikHaq: 1_000_000,
    presetlar: [
      { sabab: "CRMga kiritilmagan zakas", ball: 3 },
      { sabab: "Balansa dasturiga kiritilmagan kun", ball: 4 },
      { sabab: "Summada xatolik", ball: 2 },
      { sabab: "Ertalabki ro'yxat tashlanmagan", ball: 4 },
      { sabab: "Rasm yoki izoh to'liq emas", ball: 1 },
    ],
  },
  {
    nomi: "Bir kun oldin topshirish",
    izoh: "Zakaz kelishilgan muddatdan bir kun oldin tayyor bo'lishi.",
    oylikHaq: 500_000,
    presetlar: [
      { sabab: "Zakas bir kun oldin topshirilmagan", ball: 5 },
      { sabab: "Kech topshirilgan", ball: 2 },
    ],
  },
  {
    nomi: "Xodimlarga kunlik pul tarqatish",
    izoh: "Kunlik to'lovlar, imzo va kun oxiridagi hisob to'g'riligi.",
    oylikHaq: 1_000_000,
    presetlar: [
      { sabab: "Pul tarqatilmagan yoki kechiktirilgan", ball: 5 },
      { sabab: "Imzo olinmagan", ball: 3 },
      { sabab: "Kun oxirida hisob to'g'ri kelmagan", ball: 10, kritik: true },
    ],
  },
  {
    nomi: "Yo'qotilgan mijozlar bilan ishlash",
    izoh: "Eski mijozlarni qaytarish, qo'ng'iroq plani va oylik hisobot.",
    oylikHaq: 1_000_000,
    presetlar: [
      { sabab: "Oylik ma'lumot planidan kam", ball: 2 },
      { sabab: "Eski mijozlar qo'ng'iroq plani bajarilmagan", ball: 3 },
      { sabab: "Oylik yozma hisobot berilmagan", ball: 15, kritik: true },
    ],
  },
];

/**
 * GLOBAL (vazifadan mustaqil) jarima sabablari — ishonch buzilishi.
 * Kunlik limitga KIRMAYDI.
 */
export const GLOBAL_PRESETLAR: Array<{ sabab: string; ball: number }> = [
  { sabab: "Yolg'on ma'lumot berish", ball: 25 },
];

export interface KpiSozlamaDTO {
  mavsumOylar: number[];
  mavsumPlan: number;
  mavsumsizPlan: number;
  planBonus: number;
  boshlangichBall: number;
  kunlikLimit: number;
  intervallar: BonusIntervali[];
  ballQoidalari: BallQoidasi[];
}

/** "3,5,6" → [3,5,6] (buzilgan qiymatda bo'sh ro'yxat — plan standartga tushadi). */
export function mavsumOylarParse(matn: string): number[] {
  return matn
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
}

/**
 * Sozlamani o'qiydi; birinchi murojaatda STANDART to'plamni yozadi.
 *
 * Nega o'qishda yoziladi: modul yoqilgan biznes darhol ishlaydigan holatda
 * bo'lishi kerak — direktor sozlamalarni to'ldirmasdan turib ham hisob
 * chiqishi kerak. Amal IDEMPOTENT va bitta atomik tranzaksiyada: parallel
 * ikki so'rov ikkita to'plam yaratmaydi (`businessId` UNIQUE cheklovi).
 */
export async function kpiSozlamasi(businessId: string): Promise<KpiSozlamaDTO> {
  const mavjud = await prisma.kpiSetting.findFirst({ where: { businessId } });
  if (!mavjud) return standartYarat(businessId);

  const [intervallar, qoidalar] = await Promise.all([
    prisma.kpiSalesBracket.findMany({ where: { businessId }, orderBy: { tartib: "asc" } }),
    prisma.kpiScoreRule.findMany({ where: { businessId }, orderBy: { tartib: "asc" } }),
  ]);

  return {
    mavsumOylar: mavsumOylarParse(mavjud.mavsumOylar),
    mavsumPlan: mavjud.mavsumPlan,
    mavsumsizPlan: mavjud.mavsumsizPlan,
    planBonus: mavjud.planBonus,
    boshlangichBall: mavjud.boshlangichBall,
    kunlikLimit: mavjud.kunlikLimit,
    intervallar: intervallar.length
      ? intervallar.map((b) => ({ dan: b.dan, gacha: b.gacha, foiz: b.foiz }))
      : STANDART_INTERVALLAR,
    ballQoidalari: qoidalar.length
      ? qoidalar.map((q) => ({ minBall: q.minBall, maxBall: q.maxBall, foiz: q.foiz }))
      : STANDART_BALL_QOIDALARI,
  };
}

/**
 * Standart to'plam: sozlama + intervallar + ball jadvali + 5 ta vazifa va
 * ularning tayyor jarima sabablari.
 *
 * Tranzaksiya ichida xom `tx` ishlatiladi, shuning uchun HAR so'rovga
 * `businessId` sharti qo'lda yozilgan (lib/db/businessTx.ts).
 */
async function standartYarat(businessId: string): Promise<KpiSozlamaDTO> {
  await runBusinessTx(businessId, async (tx) => {
    const bor = await tx.kpiSetting.findFirst({ where: { businessId }, select: { id: true } });
    if (bor) return;

    await tx.kpiSetting.create({ data: { businessId } });

    for (const [i, b] of STANDART_INTERVALLAR.entries()) {
      await tx.kpiSalesBracket.create({ data: { businessId, ...b, tartib: i } });
    }
    for (const [i, q] of STANDART_BALL_QOIDALARI.entries()) {
      await tx.kpiScoreRule.create({ data: { businessId, ...q, tartib: i } });
    }

    // Vazifalar faqat biznes ULARSIZ bo'lsa yaratiladi: modul avval
    // ishlatilgan bo'lsa (o'z vazifalari bor) tegilmaydi.
    const vazifaBor = await tx.kpiTask.count({ where: { businessId } });
    if (vazifaBor > 0) return;

    for (const [i, v] of STANDART_VAZIFALAR.entries()) {
      const task = await tx.kpiTask.create({
        data: { businessId, nomi: v.nomi, izoh: v.izoh, oylikHaq: v.oylikHaq, tartib: i },
      });
      for (const [j, p] of v.presetlar.entries()) {
        await tx.kpiPenaltyPreset.create({
          data: {
            businessId,
            taskId: task.id,
            sabab: p.sabab,
            ball: p.ball,
            kritik: p.kritik ?? false,
            tartib: j,
          },
        });
      }
    }
    for (const [i, p] of GLOBAL_PRESETLAR.entries()) {
      await tx.kpiPenaltyPreset.create({
        data: { businessId, taskId: null, sabab: p.sabab, ball: p.ball, kritik: true, tartib: 900 + i },
      });
    }
  });

  return {
    mavsumOylar: mavsumOylarParse("3,5,6,7,8,9,10,11,12"),
    mavsumPlan: 100_000_000,
    mavsumsizPlan: 80_000_000,
    planBonus: 1_000_000,
    boshlangichBall: 100,
    kunlikLimit: 5,
    intervallar: STANDART_INTERVALLAR,
    ballQoidalari: STANDART_BALL_QOIDALARI,
  };
}

/**
 * Shu oyning STANDART sotuv plani (xodimga alohida plan qo'yilmagan holat).
 * Mavsum oyi bo'lsa mavsum plani, aks holda mavsumsiz plan.
 */
export function standartPlan(oy: string, s: KpiSozlamaDTO): number {
  const { monthIndex0 } = parseMonthString(oy);
  return s.mavsumOylar.includes(monthIndex0 + 1) ? s.mavsumPlan : s.mavsumsizPlan;
}
