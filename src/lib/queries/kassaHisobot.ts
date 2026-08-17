import { prisma } from "@/lib/prisma";
import { getAccountBalances, listTransferlarKundan, type TransferDTO } from "@/lib/queries/accounts";

/**
 * KASSALAR HISOBOTI — davr kesimida har kassa bo'yicha savdo, xarajat va
 * joriy qoldiq, hamda o'sha davrdagi o'tkazmalar.
 *
 * ═══ ENG MUHIM QOIDA ═══
 * O'TKAZMA DAROMAD EMAS. U "Savdo" va "Xarajat" ustunlariga umuman
 * qo'shilmaydi — alohida ro'yxatda ko'rsatiladi. Aks holda bir pul kassadan
 * kassaga o'tgani uchun kunlik aylanma sun'iy oshib ketardi.
 *
 * Davr `createdAt` bo'yicha kesiladi (yozuvning `sana` si emas): kassadagi
 * pul yozuv qaysi kunga tegishli ekaniga emas, QACHON kiritilganiga qarab
 * harakatlanadi — smena va kassa qoldig'i bilan bir xil qoida.
 */
export interface KassaHisobotQatori {
  accountId: string;
  nomi: string;
  egaIsm: string | null;
  savdo: number;
  xarajat: number;
  /** Joriy (bugungi) qoldiq — davr oxiridagi emas, ayni paytdagi holat. */
  balans: number;
}

export interface KassaHisobot {
  qatorlar: KassaHisobotQatori[];
  jamiSavdo: number;
  jamiXarajat: number;
  jamiBalans: number;
  transferlar: TransferDTO[];
}

export async function getKassaHisobot(
  businessId: string,
  boshlanish: Date,
  tugash: Date
): Promise<KassaHisobot> {
  const [qoldiqlar, guruhlar, transferlar] = await Promise.all([
    getAccountBalances(businessId),
    prisma.transaction.groupBy({
      by: ["accountId", "turi"],
      where: {
        businessId,
        deletedAt: null,
        createdAt: { gte: boshlanish, lt: tugash },
      },
      _sum: { summa: true },
    }),
    listTransferlarKundan(businessId, boshlanish, 200),
  ]);

  const kesim = new Map<string, { savdo: number; xarajat: number }>();
  for (const g of guruhlar) {
    if (!g.accountId) continue;
    const q = kesim.get(g.accountId) ?? { savdo: 0, xarajat: 0 };
    if (g.turi === "kirim") q.savdo += g._sum.summa ?? 0;
    else q.xarajat += g._sum.summa ?? 0;
    kesim.set(g.accountId, q);
  }

  const qatorlar: KassaHisobotQatori[] = qoldiqlar.map((k) => {
    const q = kesim.get(k.id) ?? { savdo: 0, xarajat: 0 };
    return {
      accountId: k.id,
      nomi: k.nomi,
      egaIsm: k.egaIsm,
      savdo: q.savdo,
      xarajat: q.xarajat,
      balans: k.qoldiq,
    };
  });

  return {
    qatorlar,
    jamiSavdo: qatorlar.reduce((a, q) => a + q.savdo, 0),
    jamiXarajat: qatorlar.reduce((a, q) => a + q.xarajat, 0),
    jamiBalans: qatorlar.reduce((a, q) => a + q.balans, 0),
    // Davr chegarasidan tashqarisi kesib tashlanadi (so'rov faqat `gte` bilan).
    transferlar: transferlar.filter((t) => new Date(t.createdAt) < tugash),
  };
}
