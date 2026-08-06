import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";

/**
 * OMBOR QOLDIG'INI TO'G'RILASH.
 *
 * Ikki holat:
 *   "inventarizatsiya" — sanaldi, haqiqiy qoldiq boshqa chiqdi. Farq ± bo'lishi
 *                        mumkin (kam chiqsa ham, ko'p chiqsa ham).
 *   "chiqarish"        — buzildi/yo'qoldi/sovg'a. Faqat KAMAYTIRADI.
 *
 * Ataylab tranzaksiya (pul) yozmaydi: bu tovar hodisasi, pul harakati emas.
 * Yo'qotishning moliyaviy ta'siri tannarx orqali allaqachon hisobga olingan.
 *
 * Har o'zgarish sababi bilan yoziladi — ilgari qoldiqni qo'lda tahrirlash
 * mumkin edi va kim/nega o'zgartirgani hech qayerda qolmasdi.
 */
export async function adjustStock(params: {
  businessId: string;
  productId: string;
  turi: "inventarizatsiya" | "chiqarish";
  /** Inventarizatsiyada — sanalgan miqdor; chiqarishda — chiqariladigan miqdor. */
  miqdor: number;
  sabab: string;
  userId: string;
}) {
  const sabab = params.sabab.trim();
  if (!sabab) throw new BadRequestError("Sabab yozilishi shart");
  if (!Number.isInteger(params.miqdor) || params.miqdor < 0) {
    throw new BadRequestError("Miqdor manfiy bo'lmagan butun son bo'lishi kerak");
  }
  if (params.turi === "chiqarish" && params.miqdor === 0) {
    throw new BadRequestError("Hisobdan chiqariladigan miqdor musbat bo'lishi kerak");
  }

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: params.productId, businessId: params.businessId },
    });
    if (!product) throw new ForbiddenError("Mahsulot topilmadi");

    const eskiMiqdor = product.miqdor;
    const yangiMiqdor =
      params.turi === "inventarizatsiya" ? params.miqdor : eskiMiqdor - params.miqdor;

    if (yangiMiqdor < 0) {
      throw new BadRequestError(
        `Omborda ${eskiMiqdor} ta bor — ${params.miqdor} tani chiqarib bo'lmaydi`
      );
    }
    if (yangiMiqdor === eskiMiqdor) {
      throw new BadRequestError("Qoldiq o'zgarmadi — yozuv yaratilmadi");
    }

    await tx.product.update({
      where: { id: product.id },
      data: { miqdor: yangiMiqdor },
    });

    return tx.stockAdjustment.create({
      data: {
        businessId: params.businessId,
        productId: product.id,
        turi: params.turi,
        eskiMiqdor,
        yangiMiqdor,
        farq: yangiMiqdor - eskiMiqdor,
        sabab,
        userId: params.userId,
      },
    });
  });

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "product",
    entityId: params.productId,
    before: { miqdor: natija.eskiMiqdor },
    after: { miqdor: natija.yangiMiqdor, turi: params.turi, sabab },
  });

  return natija;
}
