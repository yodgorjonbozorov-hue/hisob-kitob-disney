// Login global (tenantlar aro) unique — autentifikatsiya rawPrisma bilan ishlaydi.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import { Prisma } from "@prisma/client";
import { registrsizTeng } from "@/lib/db/dialect";
import { telE164, telLoginKorinishlari } from "@/lib/tel";

/**
 * Kiritilgan login bo'yicha foydalanuvchini topadi. Tartib:
 *
 *   1. AYNAN moslik — har doim birinchi (mavjud xulq o'zgarmaydi).
 *   2. TELEFON — kiritilgan matn raqamga o'xshasa, bazadagi barcha mumkin
 *      ko'rinishlar (`+998901234567`, `998901234567`, `901234567`) bo'yicha.
 *      Foydalanuvchi raqamni qanday yozishidan qat'i nazar ("90 123 45 67",
 *      "+998 (90) 123-45-67") bitta akkaunt topiladi.
 *   3. REGISTRSIZ — mobil klaviatura birinchi harfni kattalashtirganda
 *      ("Superadmin"); SQLite registrga sezgir.
 *
 * Xavfsizlik: 2- va 3-qadamda natija FAQAT bitta foydalanuvchi topilgandagina
 * qabul qilinadi. Ikkita akkaunt mos kelsa (masalan eski yozuvlarda bitta
 * raqam ikki xil formatda) — hech biri tanlanmaydi: noto'g'ri akkauntga
 * kirib qolishdan ko'ra "noto'g'ri" javobi xavfsizroq.
 */
export async function findUserByLogin(login: string) {
  const exact = await prisma.user.findUnique({ where: { login } });
  if (exact) return exact;

  const telKorinishlar = telLoginKorinishlari(login).filter((k) => k !== login);
  if (telKorinishlar.length > 0) {
    const moslar = await prisma.user.findMany({
      where: { login: { in: telKorinishlar } },
      take: 2,
    });
    if (moslar.length === 1) return moslar[0];
    if (moslar.length > 1) return null;
  }

  // Registrsiz taqqoslash provayderga bog'liq (SQLite: COLLATE NOCASE,
  // Postgres: LOWER() + funksional indeks) — `lib/db/dialect.ts` da.
  const matches = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "User" WHERE ${registrsizTeng('"login"', login)} LIMIT 2`
  );
  if (matches.length !== 1) return null;
  return prisma.user.findUnique({ where: { id: matches[0].id } });
}

/**
 * Login bo'yicha rate limit kaliti. Telefon E.164 ko'rinishiga keltiriladi:
 * aks holda bitta raqamni har xil yozib ("901234567", "+998 90 123 45 67")
 * har biriga alohida 5 ta urinish olish — ya'ni limitni chetlab o'tish mumkin edi.
 */
export function loginLimitKaliti(login: string): string {
  const tel = telLoginKorinishlari(login).length > 0 ? telE164(login) : null;
  return `login:l:${tel ?? login.toLowerCase()}`;
}

/**
 * Bu telefon raqam bilan akkaunt bormi — barcha saqlanish ko'rinishlari
 * bo'yicha. Ro'yxatdan o'tishda bitta raqam ikki xil formatda ikki akkaunt
 * ochmasligi uchun.
 */
export async function telefonBandmi(e164: string): Promise<boolean> {
  const korinishlar = telLoginKorinishlari(e164);
  if (korinishlar.length === 0) return false;
  const bor = await prisma.user.findFirst({
    where: { login: { in: korinishlar } },
    select: { id: true },
  });
  return bor !== null;
}
