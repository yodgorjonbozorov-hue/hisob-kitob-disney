import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate, todayDateOnlyString } from "@/lib/date";
import { getJamiKassaQoldiq } from "@/lib/queries/accounts";
import { getTodayTotals } from "@/lib/queries/shift";
import { getDebtTotals } from "@/lib/queries/inventory";

/**
 * "BUGUN" PANELI — kunlik kesim (mijozga xos blok, lib/mijozXos.ts).
 *
 * Kg ko'rsatkichlari faqat `birlik = "kg"` mahsulotlar bo'yicha: Fortex Selos
 * kabi og'irlik bilan savdo qiladigan bizneslar uchun "bugun necha kg sotildi /
 * olindi" savoli pul aylanmasi kabi muhim.
 *
 * Pul ko'rsatkichlari ikki xil davrga tegishli — chalkashmasin:
 *   BUGUNGI  — kirim, chiqim, sotilgan/olingan kg;
 *   JORIY    — kassa qoldig'i va ochiq qarz (butun davr bo'yicha holat).
 */
export interface ProBugun {
  /** Bugun sotilgan kg (bekor qilinmagan sotuvlar). */
  sotilganKg: number;
  /** Bugun omborga kirgan kg (xarid/kirim). */
  olinganKg: number;
  /** Bugungi kirim (tranzaksiyalar). */
  kirim: number;
  /** Bugungi chiqim (tranzaksiyalar). */
  chiqim: number;
  /** Barcha kassalar joriy qoldig'i (butun davr, ledger'dan). */
  kassaJami: number;
  /** Ochiq qarz: menga qarzdor − men qarzdorman (joriy holat). */
  qarzSof: number;
  /** Menga qarzdor (olinadigan) — ochiq qoldiq. */
  qarzOlinadigan: number;
  /** Men qarzdorman (beriladigan) — ochiq qoldiq. */
  qarzBeriladigan: number;
  /** Faol foydalanuvchilar (tenant bo'ylab). */
  faolUserlar: number;
  /** Faol ta'minotchilar (joriy biznes). */
  taminotchilar: number;
}

export async function getProBugun(businessId: string): Promise<ProBugun> {
  const bugunStr = todayDateOnlyString();
  const bugun = dateOnlyStringToUTCDate(bugunStr);

  const [sotilgan, olingan, pul, kassaJami, qarz, faolUserlar, taminotchilar] = await Promise.all([
    prisma.sale.aggregate({
      where: { businessId, deletedAt: null, sana: bugun, product: { birlik: "kg" } },
      _sum: { miqdor: true },
    }),
    prisma.stockEntry.aggregate({
      where: { businessId, createdAt: { gte: bugun }, product: { birlik: "kg" } },
      _sum: { miqdor: true },
    }),
    getTodayTotals(businessId, bugunStr),
    getJamiKassaQoldiq(businessId),
    getDebtTotals(businessId),
    prisma.user.count({ where: { isActive: true } }),
    prisma.supplier.count({ where: { businessId, deletedAt: null, isActive: true } }),
  ]);

  return {
    sotilganKg: sotilgan._sum.miqdor ?? 0,
    olinganKg: olingan._sum.miqdor ?? 0,
    kirim: pul.kirim,
    chiqim: pul.chiqim,
    kassaJami,
    qarzSof: qarz.sof,
    qarzOlinadigan: qarz.olinadigan,
    qarzBeriladigan: qarz.beriladigan,
    faolUserlar,
    taminotchilar,
  };
}
