import { InlineKeyboard, type Context } from "grammy";
import { BRAND } from "@/lib/brand";
import { botdaOchildi, botQarori, startPayloaddanToken, START_PREFIKS } from "@/lib/auth/telegramLogin";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Saytga Telegram orqali kirish — bot tomoni.
 *
 * `/start login_<token>` → bot so'rovni chat egasining akkauntiga moslaydi va
 * QAYERDAN kirilayotganini (IP, brauzer, vaqt) ko'rsatib tasdiq so'raydi.
 * Bu ko'rsatma shart: kimdir havolani o'zi yaratib, egasiga "bosing" deb
 * yuborsa, egasi notanish qurilmani ko'rib RAD eta olishi kerak.
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

function vaqt(): string {
  return new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });
}

export async function handleLoginStart(ctx: Context, payload: string): Promise<void> {
  // Faqat shaxsiy chat: guruhda tasdiq tugmasini boshqalar ham ko'radi.
  if (ctx.chat?.type !== "private") {
    await ctx.reply("Saytga kirish faqat bot bilan shaxsiy chatda tasdiqlanadi.");
    return;
  }
  const chatId = String(ctx.chat.id);
  const rl = await rateLimit(`tglogin:bot:${chatId}`, 10, 10 * 60 * 1000);
  if (!rl.ok) {
    await ctx.reply("Juda ko'p urinish. 10 daqiqadan keyin qayta urining.");
    return;
  }

  const token = startPayloaddanToken(payload);
  const natija = token ? await botdaOchildi(token, chatId) : ({ tur: "topilmadi" } as const);

  if (natija.tur === "topilmadi") {
    await ctx.reply(
      `Bu kirish havolasi eskirgan yoki ishlatilgan.\n\n${BRAND.domen} sahifasida "Telegram orqali kirish" tugmasini qayta bosing.`
    );
    return;
  }
  if (natija.tur === "boglanmagan") {
    await ctx.reply(
      `Bu Telegram hisobi hali ${BRAND.nomi} akkauntiga bog'lanmagan.\n\n` +
        `1. ${BRAND.domen} ga login va parol bilan kiring.\n` +
        `2. "Telegram bot bilan bog'lash" tugmasi orqali kod oling va bu yerga /kod 123456 deb yuboring.\n\n` +
        "Shundan keyin saytga Telegram orqali bir bosishda kira olasiz."
    );
    return;
  }

  const qayerdan = [natija.brauzer, natija.ip ? `IP ${natija.ip}` : null].filter(Boolean).join(" · ");
  const klaviatura = new InlineKeyboard()
    .text("✅ Ha, kirish", `tgl:ok:${natija.id}`)
    .text("❌ Rad etish", `tgl:no:${natija.id}`);
  await ctx.reply(
    `🔐 ${BRAND.domen} saytiga kirish so'rovi\n\n` +
      `Akkaunt: ${natija.ism}\n` +
      (qayerdan ? `Qurilma: ${qayerdan}\n` : "") +
      `Vaqt: ${vaqt()}\n\n` +
      "Agar hozir o'zingiz kirmayotgan bo'lsangiz — RAD ETING va havolani hech kimga bermang.",
    { reply_markup: klaviatura }
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
