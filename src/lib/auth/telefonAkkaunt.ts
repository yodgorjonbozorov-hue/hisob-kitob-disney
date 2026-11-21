/**
 * Telegram kontaktidagi raqam bo'yicha akkauntni topish.
 *
 * Tartib (birinchi aniq natija qaytadi):
 *   1. LOGIN — telefon bilan ro'yxatdan o'tgan akkauntlar (login = raqam,
 *      har qanday saqlangan ko'rinishda: lib/tel.ts `telLoginKorinishlari`).
 *   2. XODIM KARTOCHKASI — `Employee.tel` (HR) orqali bog'langan akkaunt.
 *      Bu raqamlar erkin formatda saqlanadi, shuning uchun normallashtirib
 *      solishtiriladi.
 *   3. BOG'LANGAN CHAT — raqam hech qayerda topilmasa, lekin shu Telegram
 *      chat `/kod` orqali akkauntga ulangan bo'lsa (masalan "kassir1" kabi
 *      harfli login, raqam kiritilmagan).
 *
 * XAVFSIZLIK: har qadamda natija FAQAT bitta faol akkaunt bo'lsa qabul
 * qilinadi. Bitta raqam ikki akkauntda uchrasa — hech biri tanlanmaydi.
 */
// Tizim darajasi (kirish paytida tenant konteksti yo'q) — rawPrisma.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import type { User } from "@prisma/client";
import { telE164, telLoginKorinishlari } from "@/lib/tel";

export type AkkauntNatija = { tur: "topildi"; user: User } | { tur: "topilmadi" } | { tur: "noaniq" };

/** Telegram kontaktidagi raqam: "998901234567" yoki "+998901234567" → E.164. */
export function kontaktRaqami(xom: string | null | undefined): string | null {
  const t = (xom ?? "").trim();
  if (!t) return null;
  return telE164(t.startsWith("+") ? t : `+${t.replace(/\D/g, "")}`);
}

export async function telefonBoyichaAkkaunt(e164: string, chatId: string): Promise<AkkauntNatija> {
  // 1. Login
  const korinishlar = telLoginKorinishlari(e164);
  if (korinishlar.length > 0) {
    const loginlar = await prisma.user.findMany({
      where: { login: { in: korinishlar }, isActive: true },
      take: 2,
    });
    if (loginlar.length === 1) return { tur: "topildi", user: loginlar[0] };
    if (loginlar.length > 1) return { tur: "noaniq" };
  }

  // 2. Xodim kartochkasi. Oxirgi ikki raqam bo'yicha oldindan toraytiriladi
  // (har qanday formatda raqam oxirida turadi), keyin aniq solishtiriladi.
  const xodimlar = await prisma.employee.findMany({
    where: { userId: { not: null }, tel: { endsWith: e164.slice(-2) } },
    select: { tel: true, userId: true },
    take: 5000,
  });
  const userIdlar = [
    ...new Set(xodimlar.filter((x) => telE164(x.tel) === e164).map((x) => x.userId as string)),
  ];
  if (userIdlar.length > 0) {
    const faollar = await prisma.user.findMany({ where: { id: { in: userIdlar }, isActive: true }, take: 2 });
    if (faollar.length === 1) return { tur: "topildi", user: faollar[0] };
    if (faollar.length > 1) return { tur: "noaniq" };
  }

  // 3. Bog'langan chat
  const boglangan = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (boglangan?.isActive) return { tur: "topildi", user: boglangan };

  return { tur: "topilmadi" };
}

/**
 * Tasdiqdan keyin chatni akkauntga bog'laydi (bot funksiyalari ochilsin) —
 * faqat xavfsiz bo'lsa: akkaunt hali hech qaysi chatga ulanmagan VA bu chat
 * boshqa akkauntga ulanmagan. Aks holda mavjud bog'lanish o'zgartirilmaydi.
 */
export async function chatniBogla(userId: string, chatId: string): Promise<void> {
  try {
    const [user, band] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } }),
      prisma.user.findUnique({ where: { telegramChatId: chatId }, select: { id: true } }),
    ]);
    if (!user || user.telegramChatId || band) return;
    await prisma.user.update({ where: { id: userId }, data: { telegramChatId: chatId } });
  } catch (error) {
    // Bog'lash qo'shimcha qulaylik — kirishni to'xtatmaydi.
    console.error("Telegram chatni bog'lab bo'lmadi:", error);
  }
}
