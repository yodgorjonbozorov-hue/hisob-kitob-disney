import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";

/**
 * CRM buyurtma statistikasi.
 *
 * BITTA HAQIQAT QOIDASI: "kirimga o'tkazilgan" summa buyurtmaning o'z
 * summasidan emas, BOG'LANGAN TRANZAKSIYADAN olinadi. Aks holda buyurtma
 * summasi kirim yozilgandan keyin tahrirlansa CRM bir raqamni, Kirim
 * boshqasini ko'rsatardi.
 */

const KUN_MS = 24 * 60 * 60 * 1000;

/** Bir kunning [boshi, ertasi) oralig'i (UTC-yarim tun, `lib/date.ts`). */
function kunOraligi(sana: string) {
  const from = dateOnlyStringToUTCDate(sana);
  return { gte: from, lt: new Date(from.getTime() + KUN_MS) };
}

export interface BuyurtmaQator {
  id: string;
  nomi: string;
  kategoriya: string | null;
  kontakt: string | null;
  tel: string | null;
  summa: number;
  /** Bog'langan kirim tranzaksiyasi (yo'q bo'lsa null). */
  transactionId: string | null;
  /** Kirimga o'tgan REAL summa (tranzaksiyadan). */
  kirimSumma: number;
  holat: string;
}

export interface KunlikXulosa {
  sana: string;
  buyurtmalar: BuyurtmaQator[];
  /** Bugungi buyurtmalar jami (summa). */
  jami: number;
  /** Shundan kirimga o'tkazilgani. */
  kirimga: number;
  /** Kutilayotgani (jami − kirimga). */
  kutilmoqda: number;
  /** Buyurtmalar soni. */
  soni: number;
}

/** "Bugungi buyurtmalar" paneli (6-talab). */
export async function kunlikBuyurtmalar(businessId: string, sana: string): Promise<KunlikXulosa> {
  const deals = await prisma.deal.findMany({
    where: { businessId, deletedAt: null, sana: kunOraligi(sana) },
    include: {
      category: { select: { nomi: true } },
      contact: { select: { ism: true, tel: true } },
      stage: { select: { nomi: true } },
      // Kirim summasi yozuvning O'ZIDAN — o'chirilgan yozuv jamiga kirmaydi.
      transaction: { select: { id: true, summa: true, deletedAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const buyurtmalar: BuyurtmaQator[] = deals.map((d) => ({
    id: d.id,
    nomi: d.nomi,
    kategoriya: d.category?.nomi ?? null,
    kontakt: d.contact?.ism ?? null,
    tel: d.contact?.tel ?? null,
    summa: d.summa,
    transactionId: d.transactionId,
    kirimSumma: d.transaction && !d.transaction.deletedAt ? d.transaction.summa : 0,
    holat: d.stage.nomi,
  }));

  const jami = buyurtmalar.reduce((a, b) => a + b.summa, 0);
  const kirimga = buyurtmalar.reduce((a, b) => a + b.kirimSumma, 0);
  return {
    sana,
    buyurtmalar,
    jami,
    kirimga,
    kutilmoqda: Math.max(0, jami - kirimga),
    soni: buyurtmalar.length,
  };
}

export interface KategoriyaQator {
  categoryId: string | null;
  nomi: string;
  soni: number;
  jami: number;
  kirimga: number;
  kutilmoqda: number;
}

/**
 * Kategoriya bo'yicha statistika (7-talab). Oraliq berilmasa — barcha
 * buyurtmalar. Kategoriyasiz eski bitimlar alohida qatorga yig'iladi.
 */
export async function kategoriyaStatistikasi(
  businessId: string,
  from?: string | null,
  to?: string | null
): Promise<KategoriyaQator[]> {
  const sanaShart =
    from || to
      ? {
          sana: {
            ...(from ? { gte: dateOnlyStringToUTCDate(from) } : {}),
            ...(to ? { lt: new Date(dateOnlyStringToUTCDate(to).getTime() + KUN_MS) } : {}),
          },
        }
      : {};

  const deals = await prisma.deal.findMany({
    where: { businessId, deletedAt: null, ...sanaShart },
    select: {
      summa: true,
      categoryId: true,
      category: { select: { nomi: true } },
      transaction: { select: { summa: true, deletedAt: true } },
    },
    take: 5000,
  });

  const xarita = new Map<string, KategoriyaQator>();
  for (const d of deals) {
    const kalit = d.categoryId ?? "";
    const qator =
      xarita.get(kalit) ??
      {
        categoryId: d.categoryId,
        nomi: d.category?.nomi ?? "Kategoriyasiz",
        soni: 0,
        jami: 0,
        kirimga: 0,
        kutilmoqda: 0,
      };
    qator.soni += 1;
    qator.jami += d.summa;
    if (d.transaction && !d.transaction.deletedAt) qator.kirimga += d.transaction.summa;
    xarita.set(kalit, qator);
  }

  return [...xarita.values()]
    .map((q) => ({ ...q, kutilmoqda: Math.max(0, q.jami - q.kirimga) }))
    .sort((a, b) => b.jami - a.jami);
}
