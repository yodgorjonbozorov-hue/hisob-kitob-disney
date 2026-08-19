import { prisma } from "@/lib/prisma";

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
        select: { miqdor: true, birlikNarx: true, jamiSumma: true, product: { select: { nomi: true } } },
      },
    },
  });

  // Kassir ismlari bitta so'rovda (chek boshiga alohida so'rov N+1 bo'lardi).
  const userIds = [...new Set(cheklar.map((c) => c.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, ism: true } })
    : [];
  const ismMap = new Map(users.map((u) => [u.id, u.ism]));

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
    satrlar: c.satrlar.map((s) => ({
      nomi: s.product.nomi,
      miqdor: s.miqdor,
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
