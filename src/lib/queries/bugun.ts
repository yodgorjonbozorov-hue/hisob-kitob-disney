import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { getTodayTotals } from "@/lib/queries/shift";
import { getKassaHolati } from "@/lib/queries/accounts";

/**
 * "BUGUNGI HOLAT" BLOKI — biznes egasi dashboardni ochganda "bugun nima
 * bo'ldi?" savoliga bitta qarashda javob beradi.
 *
 * IKKI XIL DAVR ARALASHTIRILMAYDI:
 *   BUGUNGI — kirim, chiqim, sof natija, qarzga yozilgan summa, CRM;
 *   JORIY   — kassadagi pul (butun davr qoldig'i, "bugungi tushum" EMAS).
 *
 * Raqamlar dashboard kartalari bilan BIR XIL manbadan olinadi:
 * kirim/chiqim `getTodayTotals` (qarzga yozilgani daromad emas — chiqarilgan),
 * kassa esa `getKassaHolati` (faol kassalar qoldig'i).
 */
export interface CrmBugun {
  /** Bugun qabul qilingan buyurtmalar soni. */
  yangiSoni: number;
  /** Shu buyurtmalar summasi. */
  yangiSumma: number;
  /** Bugun "yutildi" bosqichiga o'tgan buyurtmalar soni. */
  yutilganSoni: number;
  /** Shu buyurtmalar summasi. */
  yutilganSumma: number;
}

export interface BugungiHolat {
  /** "YYYY-MM-DD" — qaysi kun ko'rsatilyapti. */
  sana: string;
  kirim: number;
  chiqim: number;
  /** kirim − chiqim (bugungi sof natija). */
  sof: number;
  /** Faol kassalardagi JORIY qoldiq (bugungi emas). */
  kassaJami: number;
  /** Nechta faol kassa hisobga olindi. */
  kassaSoni: number;
  /** Bugun qarzga berilgan (olinadigan) savdo summasi — kirimga kirmaydi. */
  qarzgaYozilgan: number;
  /** Bugun yozilgan qarzlar soni. */
  qarzSoni: number;
  /** CRM moduli yoqilmagan biznesda `null` — blok CRM qatorlarisiz chiziladi. */
  crm: CrmBugun | null;
}

const KUN_MS = 24 * 60 * 60 * 1000;

export async function getBugungiHolat(
  businessId: string,
  sana: string,
  /** CRM moduli shu tenantda yoqilganmi. Yoqilmagan bo'lsa so'rov ham ketmaydi. */
  crmYoqilgan: boolean
): Promise<BugungiHolat> {
  const kunBoshi = dateOnlyStringToUTCDate(sana);
  const kunOxiri = new Date(kunBoshi.getTime() + KUN_MS);
  const kunOraligi = { gte: kunBoshi, lt: kunOxiri };

  const [pul, kassa, qarz, crmYangi, crmYutilgan] = await Promise.all([
    getTodayTotals(businessId, sana),
    getKassaHolati(businessId),
    // QARZGA YOZILGAN SAVDO — bekor qilinganlarsiz. Bu pul kassaga
    // tushmagan, shuning uchun "kirim" bilan qo'shilmaydi.
    prisma.debt.aggregate({
      where: { businessId, turi: "olinadigan", status: { not: "CANCELLED" }, sana: kunOraligi },
      _sum: { jamiSumma: true },
      _count: { _all: true },
    }),
    crmYoqilgan
      ? prisma.deal.aggregate({
          where: { businessId, deletedAt: null, sana: kunOraligi },
          _sum: { summa: true },
          _count: { _all: true },
        })
      : Promise.resolve(null),
    // YUTILGAN — bugun "WON" turidagi bosqichga o'tkazilgan buyurtmalar
    // (`yopilganAt` shu paytda qo'yiladi — lib/crm/service.ts).
    crmYoqilgan
      ? prisma.deal.aggregate({
          where: {
            businessId,
            deletedAt: null,
            yopilganAt: kunOraligi,
            stage: { turi: "WON" },
          },
          _sum: { summa: true },
          _count: { _all: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    sana,
    kirim: pul.kirim,
    chiqim: pul.chiqim,
    sof: pul.kirim - pul.chiqim,
    kassaJami: kassa.faolJami,
    kassaSoni: kassa.faolSoni,
    qarzgaYozilgan: qarz._sum.jamiSumma ?? 0,
    qarzSoni: qarz._count._all,
    crm:
      crmYangi && crmYutilgan
        ? {
            yangiSoni: crmYangi._count._all,
            yangiSumma: crmYangi._sum.summa ?? 0,
            yutilganSoni: crmYutilgan._count._all,
            yutilganSumma: crmYutilgan._sum.summa ?? 0,
          }
        : null,
  };
}
