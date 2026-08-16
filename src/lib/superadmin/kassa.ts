import { rawPrisma } from "@/lib/db/rawPrisma";
import { harakatTasiri } from "@/lib/services/kassirKassa";
import { TOSHKENT_OFFSET_MS } from "@/lib/date";

/**
 * SUPERADMIN — BARCHA TENANTLAR bo'ylab kassir kassalari kesimi.
 *
 * `rawPrisma` (scope'siz) ATAYLAB: bu tizim darajasidagi amal, u barcha
 * tenantlar bo'ylab aylanadi (CLAUDE.md dagi ruxsat etilgan istisno —
 * `src/lib/superadmin/`). Oddiy route/sahifa kodida chaqirilmaydi.
 *
 * Bu raqamlar biznes hisobotlariga (kirim/chiqim/sof) ta'sir qilmaydi va
 * ulardan hisoblanmaydi ham — ular kassirlarning QO'LIDAGI pul kesimi.
 */

export interface KassaMetrikalari {
  /** Kassa harakati bo'lgan foydalanuvchilar soni. */
  jamiKassa: number;
  /** Hozir kassirlarning qo'lida turgan (topshirilmagan) naqd. */
  jamiKassaPuli: number;
  /** Bugun (Toshkent kuni) kassalarga tushgan / kassalardan chiqqan naqd. */
  bugungiKirim: number;
  bugungiChiqim: number;
  /** Qabul qilingan topshiriqlar jami (butun tarix bo'yicha). */
  topshirilgan: number;
  /** Tasdiq kutayotgan topshiriqlar soni va summasi. */
  kutilayotgan: number;
  kutilayotganSumma: number;
  /** Qabul qilingan topshiriqlardagi kamomad va ortiqcha jamlari. */
  kamomad: number;
  ortiqcha: number;
}

/** Naqd yozuv sharti (Prisma `where` bo'lagi) — `kassirKassa` bilan bir xil qoida. */
const NAQD = {
  OR: [
    { tolovTuri: "naqd" },
    { tolovTuri: null, account: { turi: "naqd" } },
    { tolovTuri: null, accountId: null },
  ],
};

export async function getKassaMetrikalari(now: Date = new Date()): Promise<KassaMetrikalari> {
  const siljigan = new Date(now.getTime() + TOSHKENT_OFFSET_MS);
  const kunBoshi = new Date(
    Date.UTC(siljigan.getUTCFullYear(), siljigan.getUTCMonth(), siljigan.getUTCDate()) -
      TOSHKENT_OFFSET_MS
  );

  const [yozuvlar, bugungilar, harakatlar, kutilayotganlar, kamomadAgg, ortiqchaAgg] =
    await Promise.all([
      rawPrisma.transaction.groupBy({
        by: ["userId", "turi"],
        where: { deletedAt: null, ...NAQD },
        _sum: { summa: true },
      }),
      rawPrisma.transaction.groupBy({
        by: ["turi"],
        where: { deletedAt: null, createdAt: { gte: kunBoshi }, ...NAQD },
        _sum: { summa: true },
      }),
      rawPrisma.cashHandover.groupBy({
        by: ["kassirId", "turi", "farqYopildi"],
        where: { holat: "qabul" },
        _sum: { topshirilgan: true, farq: true },
      }),
      rawPrisma.cashHandover.aggregate({
        where: { holat: "kutilmoqda" },
        _sum: { topshirilgan: true },
        _count: true,
      }),
      // Kamomad va ortiqcha ALOHIDA agregatlar bilan olinadi: bitta guruh
      // ichida ikkala ishora aralashsa `_sum` ularni bir-biriga qo'shib
      // yuborardi va ikkala raqam ham kamayib ko'rinardi.
      rawPrisma.cashHandover.aggregate({
        where: { holat: "qabul", turi: "topshirish", farq: { lt: 0 } },
        _sum: { farq: true },
      }),
      rawPrisma.cashHandover.aggregate({
        where: { holat: "qabul", turi: "topshirish", farq: { gt: 0 } },
        _sum: { farq: true },
      }),
    ]);

  const qoldiqlar = new Map<string, number>();
  const qosh = (id: string, delta: number) => qoldiqlar.set(id, (qoldiqlar.get(id) ?? 0) + delta);

  for (const r of yozuvlar) {
    qosh(r.userId, (r.turi === "kirim" ? 1 : -1) * (r._sum.summa ?? 0));
  }

  let topshirilgan = 0;
  for (const r of harakatlar) {
    const qator = {
      turi: r.turi,
      farqYopildi: r.farqYopildi,
      topshirilgan: r._sum.topshirilgan ?? 0,
      farq: r._sum.farq ?? 0,
    };
    // `harakatTasiri` (topshirilgan, farq) bo'yicha CHIZIQLI, shuning uchun
    // guruh yig'indisiga qo'llash har qatorga alohida qo'llash bilan bir xil.
    qosh(r.kassirId, harakatTasiri(qator));
    if (r.turi === "topshirish") topshirilgan += qator.topshirilgan;
  }

  const bugun = (turi: string) => bugungilar.find((r) => r.turi === turi)?._sum.summa ?? 0;

  return {
    jamiKassa: qoldiqlar.size,
    jamiKassaPuli: Array.from(qoldiqlar.values()).reduce((a, v) => a + v, 0),
    bugungiKirim: bugun("kirim"),
    bugungiChiqim: bugun("chiqim"),
    topshirilgan,
    kutilayotgan: kutilayotganlar._count,
    kutilayotganSumma: kutilayotganlar._sum.topshirilgan ?? 0,
    kamomad: -(kamomadAgg._sum.farq ?? 0),
    ortiqcha: ortiqchaAgg._sum.farq ?? 0,
  };
}
