import { prisma } from "@/lib/prisma";
import { chekTelegramHolatlari, type TelegramHolatDTO } from "@/lib/queries/mijozTelegram";

/**
 * MAGAZIN (POS) o'qish so'rovlari.
 *
 * Har so'rovda `businessId` sharti bor — tenant filtri extension'da, biznes
 * filtri bu yerda (boshqa biznesga o'tib ketmaslik uchun).
 */

/** POS ekranidagi mahsulot kartochkasi. */
export interface PosMahsulotDTO {
  id: string;
  nomi: string;
  sotuvNarx: number;
  miqdor: number;
  birlik: string;
  barcode: string | null;
  qrKod: string | null;
  sku: string | null;
  categoryId: string | null;
}

/**
 * Kassa ekrani uchun mahsulotlar.
 *
 * Qoldig'i tugagan tovar ham qaytariladi (miqdor bilan): kassir uni ko'rib
 * "yo'q ekan" deyishi kerak — ro'yxatdan yashirilsa u qidirib vaqt yo'qotadi.
 */
export async function listPosMahsulotlar(businessId: string): Promise<PosMahsulotDTO[]> {
  const rows = await prisma.product.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ nomi: "asc" }],
    select: {
      id: true,
      nomi: true,
      sotuvNarx: true,
      miqdor: true,
      birlik: true,
      barcode: true,
      qrKod: true,
      sku: true,
      categoryId: true,
    },
  });
  return rows;
}

export interface PosKategoriyaDTO {
  id: string;
  nomi: string;
}

export async function listMahsulotKategoriyalar(businessId: string): Promise<PosKategoriyaDTO[]> {
  return prisma.productCategory.findMany({
    where: { businessId, isActive: true, deletedAt: null },
    orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
    select: { id: true, nomi: true },
  });
}

export interface PosChekSatriDTO {
  nomi: string;
  miqdor: number;
  /** Savdo paytidagi o'lchov birligi snapshot'i ("dona" | "kg" | "quti"...). */
  birlik: string;
  birlikNarx: number;
  jamiSumma: number;
}

export interface PosChekDTO {
  id: string;
  raqam: number;
  jamiSumma: number;
  tolovTuri: string;
  mijozNomi: string | null;
  sana: string;
  createdAt: string;
  bekorQilingan: boolean;
  cancelReason: string | null;
  kassir: string;
  satrlar: PosChekSatriDTO[];
  /**
   * Chek mijozi Telegram botga ULANGANMI. `telegram` holati bilan
   * ARALASHTIRILMAYDI: ulanmagan mijozga xabar umuman yuborilmaydi va
   * "yuborilmadi" deb ogohlantirish ham noto'g'ri bo'lardi.
   */
  mijozUlangan: boolean;
  /** Oxirgi Telegram xabarnomasi holati (spec 15). */
  telegram: TelegramHolatDTO;
}

/**
 * Oxirgi cheklar (kassa tarixi).
 *
 * Bekor qilinganlar ham chiqadi va shunday belgilanadi — kassada "qaytarilgan
 * chek" ko'rinib turishi kerak, aks holda kassir uni yana qaytarmoqchi bo'ladi.
 */
export async function listPosCheklar(businessId: string, limit = 50): Promise<PosChekDTO[]> {
  const cheklar = await prisma.posChek.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      satrlar: {
        select: {
          miqdor: true,
          birlikNarx: true,
          jamiSumma: true,
          // SNAPSHOT ustun turadi: katalog keyin o'zgarsa ham chek
          // mijozga yuborilgan holida ko'rinadi.
          birlik: true,
          mahsulotNomi: true,
          product: { select: { nomi: true, birlik: true } },
        },
      },
    },
  });

  // Kassir ismlari bitta so'rovda (chek boshiga alohida so'rov N+1 bo'lardi).
  const userIds = [...new Set(cheklar.map((c) => c.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, ism: true } })
    : [];
  const ismMap = new Map(users.map((u) => [u.id, u.ism]));

  // Telegram holati va mijoz ulanganligi — ikkita jamlangan so'rovda
  // (chek boshiga alohida so'rov yuborilsa N+1 bo'lardi).
  const contactIds = [...new Set(cheklar.map((c) => c.contactId).filter(Boolean))] as string[];
  const [tgHolatlar, ulanganlar] = await Promise.all([
    chekTelegramHolatlari(
      businessId,
      cheklar.map((c) => c.id)
    ),
    contactIds.length
      ? prisma.contact.findMany({
          where: { businessId, id: { in: contactIds }, telegramChatId: { not: null } },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);
  const ulanganSet = new Set(ulanganlar.map((c) => c.id));

  return cheklar.map((c) => ({
    id: c.id,
    raqam: c.raqam,
    jamiSumma: c.jamiSumma,
    tolovTuri: c.tolovTuri,
    mijozNomi: c.mijozNomi,
    sana: c.sana.toISOString(),
    createdAt: c.createdAt.toISOString(),
    bekorQilingan: !!c.deletedAt,
    cancelReason: c.cancelReason,
    kassir: ismMap.get(c.userId) ?? "—",
    mijozUlangan: c.contactId !== null && ulanganSet.has(c.contactId),
    telegram: tgHolatlar.get(c.id) ?? {
      holat: "ULANMAGAN",
      turi: null,
      versiya: null,
      sentAt: null,
      xato: null,
    },
    satrlar: c.satrlar.map((s) => ({
      nomi: s.mahsulotNomi ?? s.product.nomi,
      miqdor: s.miqdor,
      birlik: s.birlik ?? s.product.birlik,
      birlikNarx: s.birlikNarx,
      jamiSumma: s.jamiSumma,
    })),
  }));
}

export interface KodliMahsulotDTO {
  id: string;
  nomi: string;
  sotuvNarx: number;
  birlik: string;
  barcode: string | null;
  qrKod: string | null;
  sku: string | null;
}

/** QR / Shtrix-kod sahifasi uchun mahsulotlar ro'yxati. */
export async function listKodliMahsulotlar(businessId: string): Promise<KodliMahsulotDTO[]> {
  return prisma.product.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ nomi: "asc" }],
    select: {
      id: true,
      nomi: true,
      sotuvNarx: true,
      birlik: true,
      barcode: true,
      qrKod: true,
      sku: true,
    },
  });
}
