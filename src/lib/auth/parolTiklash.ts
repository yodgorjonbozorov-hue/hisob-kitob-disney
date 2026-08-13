import { createHash, randomInt } from "node:crypto";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { hashPassword } from "./password";
import { secretlarTeng } from "@/lib/security/compare";

/**
 * PAROLNI TIKLASH (H-7) — Telegram bot orqali, superadminsiz.
 *
 * Oqim: foydalanuvchi loginini kiritadi → hisob mavjud va Telegram ulangan
 * bo'lsa botga 6 raqamli kod boradi → kod + yangi parol bilan tasdiqlaydi.
 *
 * Xavfsizlik qarorlari:
 *  - javob HAR DOIM bir xil — login mavjudligini bilib bo'lmaydi
 *    (user enumeration yopiq), shuning uchun funksiyalar xato tashlamaydi;
 *  - kod bazada faqat SHA-256 hash ko'rinishida (10 daqiqa amal qiladi);
 *  - taqqoslash timing-safe; kod bir martalik — muvaffaqiyatda tozalanadi;
 *  - rate limit route qatlamida (login: 3/soat, IP: 10/soat).
 *
 * `rawPrisma` — autentifikatsiya tizim darajasidagi amal (CLAUDE.md, lib/auth/).
 */

const KOD_MUDDATI_MS = 10 * 60 * 1000;

/** Kod hash'i — bcrypt shart emas: kod 10 daqiqalik va rate limit ostida. */
function kodHash(kod: string): string {
  return createHash("sha256").update(kod, "utf8").digest("hex");
}

export type TiklashNatija =
  | { yuborildi: true }
  /** Hisob yo'q/nofaol yoki Telegram ulanmagan — chaqiruvchi FARQLAMAYDI (enumeration). */
  | { yuborildi: false };

/**
 * Tiklash kodini yaratadi va Telegramga yuboradi. Natijadan qat'i nazar
 * route foydalanuvchiga BIR XIL javob qaytaradi.
 */
export async function tiklashKodiniYubor(login: string): Promise<TiklashNatija> {
  const user = await rawPrisma.user.findUnique({ where: { login: login.trim() } });
  if (!user || !user.isActive || !user.telegramChatId) {
    return { yuborildi: false };
  }

  const kod = String(randomInt(100000, 1000000));
  await rawPrisma.user.update({
    where: { id: user.id },
    data: {
      resetCodeHash: kodHash(kod),
      resetCodeExpiresAt: new Date(Date.now() + KOD_MUDDATI_MS),
    },
  });

  try {
    const { bot } = await import("@/bot/bot");
    await bot.api.sendMessage(
      user.telegramChatId,
      `🔑 Parolni tiklash kodi: ${kod}\n\n` +
        `Kod 10 daqiqa amal qiladi. Agar parolni tiklashni SIZ so'ramagan ` +
        `bo'lsangiz — bu xabarni e'tiborsiz qoldiring, hisobingiz xavfsiz.`
    );
    return { yuborildi: true };
  } catch (error) {
    // Telegram ishlamadi — kod baribir bazada, lekin foydalanuvchiga yetmadi.
    // Muddati o'tgach o'zi kuchdan qoladi.
    console.error("Parol tiklash kodini yuborishda xatolik:", error);
    return { yuborildi: false };
  }
}

/**
 * Kod + yangi parol bilan tiklashni yakunlaydi.
 * `false` — kod noto'g'ri/muddati o'tgan/hisob topilmadi (sabab aytilmaydi).
 */
export async function tiklashniTasdiqla(
  login: string,
  kod: string,
  yangiParol: string
): Promise<boolean> {
  const user = await rawPrisma.user.findUnique({ where: { login: login.trim() } });
  if (!user || !user.isActive || !user.resetCodeHash || !user.resetCodeExpiresAt) {
    return false;
  }
  if (user.resetCodeExpiresAt.getTime() < Date.now()) return false;
  if (!secretlarTeng(kodHash(kod), user.resetCodeHash)) return false;

  await rawPrisma.user.update({
    where: { id: user.id },
    data: {
      parolHash: await hashPassword(yangiParol),
      mustChangePassword: false,
      // Kod bir martalik; kutayotgan Telegram bog'lash kodi ham tozalanadi
      // (hisobga endi yangi parol bilan kiriladi).
      resetCodeHash: null,
      resetCodeExpiresAt: null,
      linkCode: null,
      linkCodeExpiresAt: null,
    },
  });
  return true;
}
