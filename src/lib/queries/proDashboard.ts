import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate, todayDateOnlyString } from "@/lib/date";
import { getJamiKassaQoldiq } from "@/lib/queries/accounts";

/**
 * PRO DASHBOARD KO'RSATKICHLARI — bugungi kun kesimida.
 *
 * Kg ko'rsatkichlari faqat `birlik = "kg"` mahsulotlar bo'yicha: Fortex Selos
 * kabi og'irlik bilan savdo qiladigan bizneslar uchun "bugun necha kg sotildi /
 * olindi" savoli pul aylanmasi kabi muhim.
 */
export interface ProBugun {
  /** Bugun sotilgan kg (bekor qilinmagan sotuvlar). */
  sotilganKg: number;
  /** Bugun omborga kirgan kg (xarid/kirim). */
  olinganKg: number;
  /** Barcha kassalar joriy qoldig'i (butun davr, ledger'dan). */
  kassaJami: number;
  /** Faol foydalanuvchilar (tenant bo'ylab). */
  faolUserlar: number;
  /** Faol ta'minotchilar (joriy biznes). */
  taminotchilar: number;
}

export async function getProBugun(businessId: string): Promise<ProBugun> {
  const bugun = dateOnlyStringToUTCDate(todayDateOnlyString());

  const [sotilgan, olingan, kassaJami, faolUserlar, taminotchilar] = await Promise.all([
    prisma.sale.aggregate({
      where: { businessId, deletedAt: null, sana: bugun, product: { birlik: "kg" } },
      _sum: { miqdor: true },
    }),
    prisma.stockEntry.aggregate({
      where: { businessId, createdAt: { gte: bugun }, product: { birlik: "kg" } },
      _sum: { miqdor: true },
    }),
    getJamiKassaQoldiq(businessId),
    prisma.user.count({ where: { isActive: true } }),
    prisma.supplier.count({ where: { businessId, deletedAt: null, isActive: true } }),
  ]);

  return {
    sotilganKg: sotilgan._sum.miqdor ?? 0,
    olinganKg: olingan._sum.miqdor ?? 0,
    kassaJami,
    faolUserlar,
    taminotchilar,
  };
}
