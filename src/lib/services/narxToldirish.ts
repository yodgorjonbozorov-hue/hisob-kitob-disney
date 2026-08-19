import { runBusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";

/**
 * NARX VA QOLDIQNI OMMAVIY TO'LDIRISH.
 *
 * Nima uchun kerak: boshqa dasturdan ko'chirilgan katalog narxsiz va
 * qoldiqsiz keladi (Bito eksporti ularni bermaydi). Mavjud yo'l bilan
 * 200 ta tovarni to'ldirish 200 marta modal ochib yopish demakdir.
 *
 * Nega ODDIY "Kirim" emas: ombor kirimi XARID hisoblanadi va chiqim
 * tranzaksiya yozadi. Ko'chirilayotgan tovar esa allaqachon sotib olingan —
 * unga kirim yozilsa mijozning hisobotida bir kunda soxta "xarid" paydo
 * bo'ladi. Shuning uchun bu yerda qoldiq `StockAdjustment`
 * (inventarizatsiya) bo'lib tushadi: tovar hodisasi, pul harakati emas.
 * Import servisi ham aynan shu qoidaga bo'ysunadi.
 */
export interface NarxQatori {
  productId: string;
  kelganNarx?: number | null;
  sotuvNarx?: number | null;
  miqdor?: number | null;
}

export interface NarxNatijasi {
  yangilandi: number;
  qoldiqTogrilandi: number;
  /** Bu biznesga tegishli bo'lmagani uchun chetga chiqarilgan qatorlar. */
  topilmadi: number;
}

export async function narxlarniToldir(params: {
  businessId: string;
  userId: string;
  qatorlar: NarxQatori[];
}): Promise<NarxNatijasi> {
  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const n: NarxNatijasi = { yangilandi: 0, qoldiqTogrilandi: 0, topilmadi: 0 };

    // Tegishlilik bir marta tekshiriladi: har qator uchun alohida so'rov
    // 500 qatorli jadvalda tranzaksiya chegarasiga urardi.
    const idlar = params.qatorlar.map((q) => q.productId);
    const mavjud = await tx.product.findMany({
      where: { id: { in: idlar }, businessId: params.businessId },
      select: { id: true, miqdor: true, kelganNarx: true, sotuvNarx: true },
    });
    const xarita = new Map(mavjud.map((p) => [p.id, p]));

    for (const q of params.qatorlar) {
      const p = xarita.get(q.productId);
      // Boshqa biznesning mahsuloti — jimgina o'tkazib yuborilmaydi, sanaladi.
      if (!p) {
        n.topilmadi++;
        continue;
      }

      const data: { kelganNarx?: number; sotuvNarx?: number } = {};
      if (q.kelganNarx != null && q.kelganNarx !== p.kelganNarx) data.kelganNarx = q.kelganNarx;
      if (q.sotuvNarx != null && q.sotuvNarx !== p.sotuvNarx) data.sotuvNarx = q.sotuvNarx;

      const qoldiqOzgardi = q.miqdor != null && q.miqdor !== p.miqdor;
      if (Object.keys(data).length === 0 && !qoldiqOzgardi) continue;

      await tx.product.update({
        where: { id: p.id, businessId: params.businessId },
        data: { ...data, ...(qoldiqOzgardi ? { miqdor: q.miqdor as number } : {}) },
      });
      n.yangilandi++;

      if (qoldiqOzgardi) {
        await tx.stockAdjustment.create({
          data: {
            businessId: params.businessId,
            productId: p.id,
            turi: "inventarizatsiya",
            eskiMiqdor: p.miqdor,
            yangiMiqdor: q.miqdor as number,
            farq: (q.miqdor as number) - p.miqdor,
            sabab: "Narx va qoldiqni to'ldirish",
            userId: params.userId,
          },
        });
        n.qoldiqTogrilandi++;
      }
    }

    return n;
  });

  if (natija.yangilandi > 0) {
    await logAudit({
      businessId: params.businessId,
      action: "update",
      entity: "product",
      entityId: "narx-toldirish",
      after: {
        yangilandi: natija.yangilandi,
        qoldiqTogrilandi: natija.qoldiqTogrilandi,
        manba: "Narx va qoldiq jadvali",
      },
    });
  }

  return natija;
}
