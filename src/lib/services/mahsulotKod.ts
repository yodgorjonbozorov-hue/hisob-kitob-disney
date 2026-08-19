import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { logAudit } from "@/lib/services/audit";
import { yangiQrKod, kodniNormallash, balansaQrMi } from "@/lib/magazin/kod";

/**
 * MAHSULOT KODLARI XIZMATI — shtrix-kod biriktirish, Balansa QR yaratish va
 * skanerlangan kodni mahsulotga aylantirish.
 *
 * TENANT IZOLYATSIYASI: bu yerdagi barcha so'rovlar tenant-scoped `prisma`
 * bilan bajariladi va ustiga `businessId` sharti qo'yiladi. Ya'ni skaner
 * qanday kod yuborishidan qat'i nazar, boshqa kompaniyaning (yoki hatto
 * boshqa biznesning) mahsuloti hech qachon qaytmaydi — bu POS'ning eng
 * muhim xavfsizlik nuqtasi, chunki barcode butun mamlakat bo'ylab bir xil.
 */

/** Skanerlangan kod bo'yicha topilgan mahsulot (POS uchun minimal shakl). */
export interface KodNatijasi {
  id: string;
  nomi: string;
  sotuvNarx: number;
  miqdor: number;
  birlik: string;
  barcode: string | null;
  qrKod: string | null;
  /** Kod qaysi maydondan topildi — UI shu bo'yicha xabar ko'rsatadi. */
  manba: "barcode" | "qr" | "sku";
}

/**
 * Skanerdan yoki kameradan kelgan kod bo'yicha mahsulotni topadi.
 *
 * Qidirish tartibi ATAYLAB shunday: avval zavod shtrix-kodi (kassada eng
 * ko'p uchraydigan holat), keyin Balansa QR, oxirida SKU (kassir kodni
 * qo'lda kiritgan bo'lishi mumkin). Har bosqich `businessId` bilan
 * cheklangan.
 */
export async function kodBoyichaMahsulot(
  businessId: string,
  xomKod: string
): Promise<KodNatijasi | null> {
  const kod = kodniNormallash(xomKod);
  if (!kod) return null;

  const tanla = {
    id: true,
    nomi: true,
    sotuvNarx: true,
    miqdor: true,
    birlik: true,
    barcode: true,
    qrKod: true,
  } as const;

  // Balansa QR ko'rinishidagi kod uchun barcode bo'yicha qidirishning ma'nosi
  // yo'q — darhol qrKod tekshiriladi.
  if (!balansaQrMi(kod)) {
    const barcodeBoyicha = await prisma.product.findFirst({
      where: { businessId, barcode: kod, isActive: true },
      select: tanla,
    });
    if (barcodeBoyicha) return { ...barcodeBoyicha, manba: "barcode" };
  }

  const qrBoyicha = await prisma.product.findFirst({
    where: { businessId, qrKod: kod, isActive: true },
    select: tanla,
  });
  if (qrBoyicha) return { ...qrBoyicha, manba: "qr" };

  const skuBoyicha = await prisma.product.findFirst({
    where: { businessId, sku: kod, isActive: true },
    select: tanla,
  });
  if (skuBoyicha) return { ...skuBoyicha, manba: "sku" };

  return null;
}

/**
 * Mahsulotga zavod shtrix-kodini biriktiradi (yoki olib tashlaydi).
 *
 * Unique cheklov BIZNES ICHIDA: bir do'konda ikkita mahsulotda bir xil kod
 * bo'lishi xato (skaner qaysi birini tanlashni bilmaydi), lekin boshqa
 * do'konda o'sha kod bemalol bo'ladi.
 */
export async function barcodeBiriktir(params: {
  businessId: string;
  productId: string;
  barcode: string | null;
}) {
  const kod = params.barcode?.trim() ? kodniNormallash(params.barcode) : null;
  if (kod && kod.length > 64) {
    throw new BadRequestError("Shtrix-kod juda uzun");
  }

  const product = await prisma.product.findFirst({
    where: { id: params.productId, businessId: params.businessId },
    select: { id: true, barcode: true },
  });
  if (!product) throw new ForbiddenError("Mahsulot topilmadi");

  if (kod) {
    const band = await prisma.product.findFirst({
      where: { businessId: params.businessId, barcode: kod, id: { not: product.id } },
      select: { nomi: true },
    });
    if (band) {
      throw new BadRequestError(`Bu shtrix-kod "${band.nomi}" mahsulotiga biriktirilgan`);
    }
  }

  await prisma.product.update({ where: { id: product.id }, data: { barcode: kod } });
  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "product",
    entityId: product.id,
    before: { barcode: product.barcode },
    after: { barcode: kod },
  });
  return { ok: true, barcode: kod };
}

/**
 * Mahsulotga Balansa QR kaliti yaratadi (allaqachon bo'lsa o'shani qaytaradi).
 *
 * Kalit BARQAROR: bir marta yaratilgach o'zgarmaydi. Chop etilgan stiker
 * mahsulot narxi yoki qoldig'i o'zgarganda ham amal qilaveradi.
 */
export async function qrKodYarat(params: { businessId: string; productId: string }) {
  const product = await prisma.product.findFirst({
    where: { id: params.productId, businessId: params.businessId },
    select: { id: true, qrKod: true },
  });
  if (!product) throw new ForbiddenError("Mahsulot topilmadi");
  if (product.qrKod) return { ok: true, qrKod: product.qrKod, yangi: false };

  // To'qnashuv ehtimoli juda past (31^8 ≈ 8.5×10^11), lekin unique cheklov
  // baribir bazada — shuning uchun bir necha marta urinib ko'riladi.
  for (let i = 0; i < 5; i++) {
    const kod = yangiQrKod();
    const band = await prisma.product.findFirst({
      where: { businessId: params.businessId, qrKod: kod },
      select: { id: true },
    });
    if (band) continue;
    await prisma.product.update({ where: { id: product.id }, data: { qrKod: kod } });
    await logAudit({
      businessId: params.businessId,
      action: "update",
      entity: "product",
      entityId: product.id,
      after: { qrKod: kod },
    });
    return { ok: true, qrKod: kod, yangi: true };
  }
  throw new BadRequestError("QR kod yaratib bo'lmadi — qaytadan urinib ko'ring");
}

/**
 * OMMAVIY QR YARATISH — kodsiz tovarlarning HAMMASIGA bir amalda.
 *
 * Nega kerak: 100+ tovarli do'konda har mahsulot uchun alohida tugma bosish
 * amalda bajarib bo'lmaydigan ish. Yangi do'kon Balansa'ga ko'chganda esa
 * aynan shu holat — katalog to'la, kod esa hech qayerda yo'q.
 *
 * QAMROV: faqat FAOL va HECH QANDAY kodi yo'q tovarlar. Zavod shtrix-kodi
 * bor tovarga QR yaratilmaydi — uning kodi allaqachon quti ustida va
 * skaner uni o'qiy oladi, ortiqcha stiker chop etishning hojati yo'q.
 *
 * IDEMPOTENT: qayta ishga tushirilsa allaqachon kodi borlar tegilmaydi,
 * ya'ni tugmani ikki marta bosish zararsiz.
 */
export async function qrKodHammasiga(params: {
  businessId: string;
  /** Bir yurishdagi chegara — kutilmagan katta katalogda uzoq ishlab qolmasin. */
  chegara?: number;
}): Promise<{ yaratildi: number; qolgan: number }> {
  const chegara = params.chegara ?? 500;

  const kodsizlar = await prisma.product.findMany({
    where: {
      businessId: params.businessId,
      isActive: true,
      barcode: null,
      qrKod: null,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: chegara + 1,
  });

  const ishlanadi = kodsizlar.slice(0, chegara);
  let yaratildi = 0;
  for (const p of ishlanadi) {
    // Har biri alohida — bittasida to'qnashuv bo'lsa qolgani davom etadi.
    const natija = await qrKodYarat({ businessId: params.businessId, productId: p.id });
    if (natija.yangi) yaratildi++;
  }

  return { yaratildi, qolgan: Math.max(0, kodsizlar.length - ishlanadi.length) };
}
