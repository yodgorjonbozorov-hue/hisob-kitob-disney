import { InlineKeyboard, Keyboard, type Context } from "grammy";
import { BRAND } from "@/lib/brand";
import {
  botdaOchildi,
  botQarori,
  kontaktKeldi,
  startPayloaddanToken,
  START_PREFIKS,
} from "@/lib/auth/telegramLogin";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Saytga Telegram orqali kirish — bot tomoni.
 *
 *   /start login_<token>  →  "📱 Raqamni yuborish" (request_contact tugmasi)
 *   kontakt               →  raqam tekshiriladi, akkaunt topiladi
 *                         →  qurilma/IP/vaqt ko'rsatilib "Ha, kirish / Rad etish"
 *
 * Raqam faqat Telegram'ning `request_contact` tugmasi orqali olinadi — qo'lda
 * yozilgan raqam qabul qilinmaydi: tugma Telegram akkauntiga biriktirilgan
 * (Telegram tasdiqlagan) raqamni yuboradi.
 *
 * Obuna holati (`tenantHandler`) bu yerda TEKSHIRILMAYDI — parol bilan kirish
 * ham uni tekshirmaydi; to'lov muddati o'tgan mijoz saytga kirib to'lay olishi kerak.
 */

/** `/start` payload'i kirish so'rovimi — bot.ts dagi /start shu bilan ajratadi. */
export function kirishSorovimi(payload: string | undefined): boolean {
  // Yaroqsiz token ham shu yerga tushadi — foydalanuvchi "havola eskirgan" degan
  // aniq javob oladi (umumiy /start salomlashuvi emas).
  return (payload ?? "").startsWith(START_PREFIKS);
}

const ESKIRGAN = `Bu kirish havolasi eskirgan yoki ishlatilgan.\n\n${BRAND.domen} sahifasida "Telegram bilan davom etish" tugmasini qayta bosing.`;
const KLAVIATURANI_YOP = { reply_markup: { remove_keyboard: true as const } };

function vaqt(): string {
  return new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });
}

async function limitOtdimi(ctx: Context, chatId: string): Promise<boolean> {
  const rl = await rateLimit(`tglogin:bot:${chatId}`, 10, 10 * 60 * 1000);
  if (!rl.ok) await ctx.reply("Juda ko'p urinish. 10 daqiqadan keyin qayta urining.");
  return rl.ok;
}

export async function handleLoginStart(ctx: Context, payload: string): Promise<void> {
  // Faqat shaxsiy chat: guruhda kontakt va tasdiq tugmasini boshqalar ham ko'radi.
  if (ctx.chat?.type !== "private") {
    await ctx.reply("Saytga kirish faqat bot bilan shaxsiy chatda tasdiqlanadi.");
    return;
  }
  const chatId = String(ctx.chat.id);
  if (!(await limitOtdimi(ctx, chatId))) return;

  const token = startPayloaddanToken(payload);
  const natija = token ? await botdaOchildi(token, chatId) : ({ tur: "topilmadi" } as const);
  if (natija.tur === "topilmadi") {
    await ctx.reply(ESKIRGAN);
    return;
  }

  const klaviatura = new Keyboard().requestContact("📱 Raqamni yuborish").resized().oneTime();
  await ctx.reply(
    `🔐 ${BRAND.domen} saytiga kirish\n\n` +
      "Shaxsingizni tasdiqlash uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing. " +
      "Telegram akkauntingizga biriktirilgan raqam yuboriladi.",
    { reply_markup: klaviatura }
  );
}

export async function handleLoginContact(ctx: Context): Promise<void> {
  const contact = ctx.message?.contact;
  if (!contact || ctx.chat?.type !== "private" || !ctx.from) return;
  const chatId = String(ctx.chat.id);
  if (!(await limitOtdimi(ctx, chatId))) return;

  const natija = await kontaktKeldi({
    chatId,
    fromId: ctx.from.id,
    contactUserId: contact.user_id,
    telefon: contact.phone_number,
  });

  if (natija.tur === "sorov_yoq") {
    await ctx.reply(ESKIRGAN, KLAVIATURANI_YOP);
    return;
  }
  if (natija.tur === "begona_kontakt") {
    // Klaviatura YOPILMAYDI — foydalanuvchi o'z raqamini tugma bilan yubora oladi.
    await ctx.reply("Faqat o'zingizning raqamingizni «📱 Raqamni yuborish» tugmasi orqali yuboring.");
    return;
  }
  if (natija.tur === "raqam_yaroqsiz") {
    await ctx.reply("Raqamni aniqlab bo'lmadi. Telegram akkauntingizdagi raqamni tekshiring.", KLAVIATURANI_YOP);
    return;
  }
  if (natija.tur === "topilmadi") {
    await ctx.reply(
      `Bu raqam bilan ${BRAND.nomi} akkaunti topilmadi.\n\n` +
        `Saytga login va parol bilan kiring yoki kompaniyangiz direktoridan raqamingizni ` +
        "xodim kartochkasiga yozib qo'yishini so'rang.",
      KLAVIATURANI_YOP
    );
    return;
  }

  await ctx.reply("✅ Raqam qabul qilindi.", KLAVIATURANI_YOP);
  const qayerdan = [natija.brauzer, natija.ip ? `IP ${natija.ip}` : null].filter(Boolean).join(" · ");
  const tugmalar = new InlineKeyboard()
    .text("✅ Ha, kirish", `tgl:ok:${natija.id}`)
    .text("❌ Rad etish", `tgl:no:${natija.id}`);
  await ctx.reply(
    `🔐 ${BRAND.domen} saytiga kirish so'rovi\n\n` +
      `Akkaunt: ${natija.ism}\n` +
      (qayerdan ? `Qurilma: ${qayerdan}\n` : "") +
      `Vaqt: ${vaqt()}\n\n` +
      "Agar hozir o'zingiz kirmayotgan bo'lsangiz — RAD ETING va havolani hech kimga bermang.",
    { reply_markup: tugmalar }
  );
}

export async function handleLoginCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const m = /^tgl:(ok|no):([0-9a-f]{40})$/.exec(data);
  const chatId = ctx.chat?.id;
  if (!m || chatId === undefined || ctx.chat?.type !== "private") {
    await ctx.answerCallbackQuery();
    return;
  }

  const natija = await botQarori(m[2], String(chatId), m[1] === "ok");
  const matn: Record<typeof natija, string> = {
    tasdiqlandi: `✅ Kirish tasdiqlandi. Brauzerga qayting — ${BRAND.nomi} o'zi ochiladi.`,
    rad: "❌ Kirish rad etildi. Hech kim akkauntingizga kirmadi.",
    eskirgan: "Bu so'rov eskirgan yoki allaqachon ko'rib chiqilgan.",
  };
  await ctx.answerCallbackQuery({ text: natija === "tasdiqlandi" ? "Tasdiqlandi" : undefined });
  // Tugmalar olib tashlanadi — ikkinchi marta bosib bo'lmasin.
  await ctx.editMessageText(matn[natija]).catch(() => ctx.reply(matn[natija]));
}
