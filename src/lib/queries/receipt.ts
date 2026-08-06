import { prisma } from "@/lib/prisma";
import { formatDateUZ } from "@/lib/format";
import type { ReceiptData } from "@/lib/pdf/ReceiptDocument";

/**
 * Chek uchun kerakli ma'lumot. Sotuv shu biznesniki ekani tekshiriladi
 * (tenant filtri extension'da, biznes sharti bu yerda — cross-business himoya).
 */
export async function getReceiptData(
  businessId: string,
  saleId: string
): Promise<ReceiptData | null> {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, businessId },
    include: {
      product: { select: { nomi: true, birlik: true } },
      business: { select: { nomi: true } },
      debt: { select: { jamiSumma: true, tolangan: true } },
    },
  });
  if (!sale) return null;

  const kassir = await prisma.user.findUnique({
    where: { id: sale.userId },
    select: { ism: true },
  });

  return {
    businessNomi: sale.business.nomi,
    saleId: sale.id,
    sana: formatDateUZ(sale.sana),
    mahsulot: sale.product.nomi,
    birlik: sale.product.birlik,
    miqdor: sale.miqdor,
    birlikNarx: sale.birlikNarx,
    jamiSumma: sale.jamiSumma,
    tolovTuri: sale.tolovTuri,
    mijozNomi: sale.mijozNomi,
    qolganQarz: sale.debt ? sale.debt.jamiSumma - sale.debt.tolangan : null,
    kassir: kassir?.ism ?? "—",
  };
}
