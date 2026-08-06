import { InlineKeyboard, type Context } from "grammy";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { flowStore } from "./conversationStore";
import { chekniOqi, MAX_RASM_BAYT } from "@/lib/ai/chekOcr";
import { AiSozlanmaganError } from "@/lib/ai/claude";
import { aiLimitTekshir } from "@/lib/ai/limit";
import { chiqimYubor } from "@/lib/services/approval";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import { formatSomLabel, formatDateUZ } from "@/lib/format";
import { todayDateOnlyString, dateOnlyStringToUTCDate } from "@/lib/date";

/**
 * CHEK RASMI OQIMI (Faza 6.5).
 *
 * Telegramga rasm tashlanadi -> Claude vision chekni o'qiydi -> bot TAKLIF
 * ko'rsatadi -> foydalanuvchi kategoriyani tanlab tasdiqlaydi -> shundagina
 * chiqim yoziladi.
 *
 * Model xato o'qishi mumkin, shuning uchun avtomatik yozish ataylab yo'q:
 * oxirgi so'z har doim odamda qoladi. Yozuv `chiqimYubor` orqali ketadi —
 * demak tasdiqlash chegarasi ham o'z kuchida.
 */
interface ChekFlowState {
  businessId: string;
  summa: number;
  sana: string;
  izoh: string;
  ishonch: string;
  /** Model tavsiya qilgan kategoriya nomi (bo'lsa tugmalarda birinchi turadi). */
  taklif: string | null;
}

const chekFlow = flowStore<ChekFlowState>("chek");

export function clearChekFlow(chatId: string): Promise<void> {
  return chekFlow.delete(chatId);
}

/** Foydalanuvchining faol biznesi: kassirda biriktirilgani, boshqada birinchisi. */
async function biznesniAniqla(user: User): Promise<{ id: string; nomi: string } | null> {
  if (user.businessId) {
    return prisma.business.findFirst({
      where: { id: user.businessId, isActive: true },
      select: { id: true, nomi: true },
    });
  }
  return prisma.business.findFirst({
    where: { isActive: true },
    orderBy: { nomi: "asc" },
    select: { id: true, nomi: true },
  });
}

async function kategoriyalarniKorsat(ctx: Context, businessId: string, taklif: string | null) {
  const kategoriyalar = await prisma.category.findMany({
    where: { businessId, turi: "chiqim", isActive: true },
    orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
    select: { id: true, nomi: true },
  });
  if (kategoriyalar.length === 0) {
    await ctx.reply("Bu biznesda chiqim kategoriyalari sozlanmagan. Veb-saytda qo'shing.");
    return false;
  }

  // Model tavsiya qilgani birinchi bo'lib chiqadi — eng ko'p bosiladigan tugma.
  const saralangan = taklif
    ? [
        ...kategoriyalar.filter((k) => k.nomi.toLowerCase() === taklif.toLowerCase()),
        ...kategoriyalar.filter((k) => k.nomi.toLowerCase() !== taklif.toLowerCase()),
      ]
    : kategoriyalar;

  const keyboard = new InlineKeyboard();
  saralangan.forEach((k, i) => {
    keyboard.text(k.nomi, `chk:${k.id}`);
    if (i % 2 === 1) keyboard.row();
  });
  keyboard.row().text("✖️ Bekor qilish", "chbekor");

  await ctx.reply("Kategoriyani tanlang — shundan keyin chiqim yoziladi:", {
    reply_markup: keyboard,
  });
  return true;
}

/** Rasm kelganda chaqiriladi. */
export async function handleChekPhoto(ctx: Context, user: User) {
  if (!user.tenantId) return;

  if (!(await isModuleOnForTenant(user.tenantId, "AI"))) {
    await ctx.reply(
      "Chek o'qish AI moduliga kiradi. Veb-saytda Sozlamalar → Modullar bo'limidan yoqing (PRO tarif)."
    );
    return;
  }

  const limit = await aiLimitTekshir(user.tenantId);
  if (!limit.ok) {
    await ctx.reply("Bugungi AI limiti tugadi. Ertaga qayta urinib ko'ring.");
    return;
  }

  const biznes = await biznesniAniqla(user);
  if (!biznes) {
    await ctx.reply("Hali biznes yaratilmagan. Veb-saytda biznes qo'shing.");
    return;
  }

  // Telegram bir necha o'lchamda yuboradi — eng kattasini olamiz.
  const rasmlar = ctx.message?.photo ?? [];
  const eng = rasmlar[rasmlar.length - 1];
  if (!eng) return;
  if (eng.file_size && eng.file_size > MAX_RASM_BAYT) {
    await ctx.reply("Rasm juda katta (5 MB dan oshmasin). Kichikroq qilib qayta yuboring.");
    return;
  }

  await ctx.reply("Chek o'qilmoqda…");

  let natija;
  try {
    const file = await ctx.api.getFile(eng.file_id);
    const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Rasmni yuklab bo'lmadi (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_RASM_BAYT) {
      await ctx.reply("Rasm juda katta (5 MB dan oshmasin).");
      return;
    }

    const kategoriyalar = await prisma.category.findMany({
      where: { businessId: biznes.id, turi: "chiqim", isActive: true },
      select: { nomi: true },
    });

    natija = await chekniOqi({
      base64: buf.toString("base64"),
      mediaType: "image/jpeg",
      kategoriyalar: kategoriyalar.map((k) => k.nomi),
    });
  } catch (error) {
    if (error instanceof AiSozlanmaganError) {
      await ctx.reply("AI hali sozlanmagan — administratorga murojaat qiling.");
      return;
    }
    console.error("Chek o'qishda xatolik:", error);
    await ctx.reply("Chekni o'qib bo'lmadi. Qayta urinib ko'ring yoki /chiqim bilan qo'lda kiriting.");
    return;
  }

  if (!natija) {
    await ctx.reply(
      "Chekdagi summani ishonchli o'qiy olmadim — noto'g'ri raqam yozib qo'ymaslik uchun to'xtadim.\n" +
        "Rasmni yorug'roq qilib qayta yuboring yoki /chiqim bilan qo'lda kiriting."
    );
    return;
  }

  const sana = natija.sana ?? todayDateOnlyString();
  const izoh = [natija.savdoNomi, ctx.message?.caption?.trim()].filter(Boolean).join(" · ").slice(0, 300);

  await chekFlow.set(String(ctx.chat!.id), {
    businessId: biznes.id,
    summa: natija.summa,
    sana,
    izoh,
    ishonch: natija.ishonch,
    taklif: natija.kategoriya,
  });

  const qatorlar = [
    "🧾 Chekdan o'qildi (bu hali TAKLIF — yozuv yaratilmadi):",
    `Biznes: ${biznes.nomi}`,
    `Summa: ${formatSomLabel(natija.summa)}`,
    `Sana: ${formatDateUZ(dateOnlyStringToUTCDate(sana))}`,
    izoh ? `Izoh: ${izoh}` : null,
    natija.ishonch === "past" ? "⚠️ Ishonch past — raqamni chek bilan solishtiring." : null,
  ].filter(Boolean);
  await ctx.reply(qatorlar.join("\n"));

  const ok = await kategoriyalarniKorsat(ctx, biznes.id, natija.kategoriya);
  if (!ok) await clearChekFlow(String(ctx.chat!.id));
}

/** Kategoriya tanlandi — chiqim yoziladi (yoki tasdiqqa yuboriladi). */
export async function handleChekCategoryCallback(ctx: Context, user: User) {
  const chatId = String(ctx.chat!.id);
  const flow = await chekFlow.get(chatId);
  if (!flow) {
    await ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan, chekni qayta yuboring." });
    return;
  }

  const categoryId = (ctx.callbackQuery?.data ?? "").slice(4);
  const kategoriya = await prisma.category.findFirst({
    where: { id: categoryId, businessId: flow.businessId, turi: "chiqim" },
    select: { nomi: true },
  });
  if (!kategoriya) {
    await ctx.answerCallbackQuery({ text: "Kategoriya topilmadi" });
    return;
  }

  await ctx.answerCallbackQuery();

  const tasdiqYoqiq = user.tenantId
    ? await isModuleOnForTenant(user.tenantId, "TASDIQLASH")
    : false;

  let natija;
  try {
    natija = await chiqimYubor({
      modulYoqilgan: tasdiqYoqiq,
      businessId: flow.businessId,
      user: { id: user.id, rol: user.rol, ism: user.ism },
      data: {
        turi: "chiqim",
        categoryId,
        summa: flow.summa,
        sana: flow.sana,
        izoh: flow.izoh || null,
      },
    });
  } catch (error) {
    await clearChekFlow(chatId);
    await ctx.editMessageText(
      error instanceof Error ? error.message : "Chiqimni yozib bo'lmadi"
    );
    return;
  }

  await clearChekFlow(chatId);

  if (natija.tasdiqKerak) {
    await ctx.editMessageText(
      [
        "⏳ Tasdiq kutilmoqda",
        `${kategoriya.nomi} · ${formatSomLabel(flow.summa)}`,
        "Bu chiqim rahbar tasdiqlagandan keyin yoziladi.",
      ].join("\n")
    );
    return;
  }

  await ctx.editMessageText(
    [
      "✅ Chiqim saqlandi",
      `Kategoriya: ${kategoriya.nomi}`,
      `Summa: ${formatSomLabel(flow.summa)}`,
      `Sana: ${formatDateUZ(dateOnlyStringToUTCDate(flow.sana))}`,
      flow.izoh ? `Izoh: ${flow.izoh}` : null,
    ]
      .filter(Boolean)
      .join("\n")
  );
}

export async function handleChekBekorCallback(ctx: Context) {
  await clearChekFlow(String(ctx.chat!.id));
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Bekor qilindi — hech narsa yozilmadi.");
}
