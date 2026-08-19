import { prisma } from "@/lib/prisma";
import { MAHSULOT_USTUNLARI, USTUN_SARLAVHALARI } from "@/lib/services/mahsulotImport";

/**
 * KATALOG EKSPORTI.
 *
 * Ustunlar importnikiga AYNAN teng — bu ataylab. Shu tufayli oddiy ish oqimi
 * ochiladi: eksport -> Excel'da narx/qoldiqni to'ldirish -> qayta import.
 * Bito kabi dasturlarning eksporti narx bermaydi, shuning uchun ko'chirishdan
 * keyin narxni kiritishning eng tez yo'li aynan shu.
 */
export interface EksportQatori {
  nomi: string;
  sku: string;
  barcode: string;
  kategoriya: string;
  birlik: string;
  kelganNarx: number;
  sotuvNarx: number;
  miqdor: number;
  minQoldiq: number;
  izoh: string;
}

export const EKSPORT_SARLAVHASI: string[] = MAHSULOT_USTUNLARI.map((u) => USTUN_SARLAVHALARI[u]);

/** Eksport qatorini sarlavha tartibida massivga aylantiradi. */
export function eksportQatoriMassiv(q: EksportQatori): (string | number)[] {
  return MAHSULOT_USTUNLARI.map((u) => q[u]);
}

export async function listMahsulotEksport(businessId: string): Promise<EksportQatori[]> {
  const products = await prisma.product.findMany({
    where: { businessId },
    orderBy: [{ isActive: "desc" }, { nomi: "asc" }],
    include: { category: { select: { nomi: true } } },
  });

  return products.map((p) => ({
    nomi: p.nomi,
    sku: p.sku ?? "",
    // Zavod kodi bo'lmasa Balansa QR kaliti chiqadi: eksport faylida tovarni
    // aniqlaydigan kod har doim bo'lsin.
    barcode: p.barcode ?? p.qrKod ?? "",
    kategoriya: p.category?.nomi ?? "",
    birlik: p.birlik,
    kelganNarx: p.kelganNarx,
    sotuvNarx: p.sotuvNarx,
    miqdor: p.miqdor,
    minQoldiq: p.minQoldiq,
    izoh: p.izoh ?? "",
  }));
}
