import { Bot, type Context } from "grammy";
import type { User } from "@prisma/client";
import { findUserByChatId, linkByCode } from "./auth";
import { runWithTenant } from "@/lib/db/tenantContext";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { computeAccess } from "@/lib/billing/access";
import { isManager } from "@/lib/auth/roles";
import {
  startTransactionFlow,
  handleBusinessCallback,
  handleCategoryCallback,
  handleDateCallback,
  handleSkipIzohCallback,
  handleFlowText,
} from "./transactionFlow";
import { startMonthlyReport, handleReportBusinessCallback, sendReportDocument } from "./report";
import { startLeadFlow, handleLeadBusinessCallback, handleLeadText, clearLeadFlow } from "./leadFlow";
import {
  startMashinaFlow,
  startXarajatFlow,
  handleMashinaBusinessCallback,
  handleMashinaTolovCallback,
  handleXarajatBusinessCallback,
  handleXarajatMashinaCallback,
  handleXarajatTuriCallback,
  startSotishFlow,
  handleSotishBusinessCallback,
  handleSotishMashinaCallback,
  handleSotishTolovCallback,
  handleAvtoText,
  clearAvtoFlow,
} from "./avtoFlow";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import { modulByCode } from "@/lib/modules/registry";
import { BRAND } from "@/lib/brand";
import { clearAllFlows } from "./conversationStore";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN .env faylida topilmadi.");
}

export const bot = new Bot(token);

/**
 * Buyruqlar ro'yxati. Avto rejimidagi kompaniyada mashina/xarajat buyruqlari
 * ham ko'rsatiladi (boshqalarda ular keraksiz).
 */
async function buyruqlarRoyxati(user: { rol: string; tenantId: string | null }): Promise<string> {
  const qatorlar = [
    "Buyruqlar:",
    "/kirim — kirim kiritish",
    "/chiqim — chiqim kiritish",
    "/lead — yangi mijoz/bitim (CRM)",
  ];

  if (isManager(user.rol) && user.tenantId) {
    const avtoBiznes = await rawPrisma.business.findFirst({
      where: { tenantId: user.tenantId, turi: "avto", isActive: true },
      select: { id: true },
    });
    if (avtoBiznes) {
      qatorlar.push(
        "/mashina — avtoparkka mashina qabul qilish",
        "/xarajat — mashinaga xarajat yozish",
        "   tez yo'l: «xarajat: Cobalt, ta'mirlash 2 mln»",
        "/sotish — mashinani sotish (sof foyda darhol ko'rinadi)"
      );
    }
  }
  if (isManager(user.rol)) qatorlar.push("/hisobot — joriy oy hisoboti");
  return qatorlar.join("\n");
}

/**
 * Har bir himoyalangan handler: foydalanuvchi chatId bo'yicha aniqlanadi,
 * so'ng uning TENANTI kontekstida bajariladi — barcha prisma so'rovlari
 * avtomatik shu tenantga cheklanadi (boshqa mijoz ma'lumoti ko'rinmaydi).
 */
function tenantHandler(
  fn: (ctx: Context, user: User) => Promise<void>,
  opts: { managerOnly?: boolean; yozish?: boolean } = {}
) {
  return async (ctx: Context) => {
    const chatId = String(ctx.chat!.id);
    const user = await findUserByChatId(chatId);
    const isCallback = !!ctx.callbackQuery;

    const deny = async (text: string) => {
      if (isCallback) await ctx.answerCallbackQuery({ text });
      else await ctx.reply(text);
    };

    if (!user || !user.isActive) {
      await deny("Avval /kod orqali tizimga ulaning.");
      return;
    }
    if (!user.tenantId) {
      await deny("Kompaniya aniqlanmadi. Administratorga murojaat qiling.");
      return;
    }
    if (opts.managerOnly && !isManager(user.rol)) {
      await deny("Bu amal faqat direktor uchun mavjud.");
      return;
    }

    // Obuna holati guard'i — veb bilan bir xil qoidalar bot uchun ham.
    const tenant = await rawPrisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) {
      await deny("Kompaniya topilmadi.");
      return;
    }
    const access = computeAccess(tenant);
    if (access.mode === "BILLING_ONLY") {
      await deny("Obuna faol emas. Veb-saytdagi \"Obuna va to'lov\" bo'limi orqali to'lov qiling.");
      return;
    }
    if (access.mode === "READONLY" && opts.yozish) {
      await deny("To'lov muddati o'tgan — yozish vaqtincha yopiq. Veb-saytda to'lov qiling.");
      return;
    }

    await runWithTenant(user.tenantId, () => fn(ctx, user));
  };
}

bot.command("start", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const user = await findUserByChatId(chatId);
  if (user) {
    await ctx.reply(
      `Salom, ${user.ism}! Siz allaqachon tizimga ulangansiz.\n\n${await buyruqlarRoyxati(user)}`
    );
    return;
  }
  await ctx.reply(
    `${BRAND.nomi} — biznesingiz balansda.\n\n` +
      `Bu ${BRAND.nomi} boti: kirim-chiqim, lead va hisobotlar Telegram orqali.\n\n` +
      `Botdan foydalanish uchun avval ${BRAND.domen} saytida tizimga kiring, so'ng "Telegram bot bilan bog'lash" ` +
      "tugmasi orqali kod oling va bu yerga /kod 123456 ko'rinishida yuboring."
  );
});

bot.command("kod", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const code = ctx.match?.toString().trim();
  if (!code) {
    await ctx.reply("Kodni shunday yozing: /kod 123456");
    return;
  }

  const result = await linkByCode(chatId, code);
  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: "Bunday kod topilmadi. Veb-saytda yangi kod oling.",
      expired: "Kod muddati o'tgan. Veb-saytda yangi kod oling.",
      chat_already_linked: "Bu Telegram hisobi allaqachon boshqa foydalanuvchiga bog'langan.",
      juda_kop_urinish: "Juda ko'p urinish. 10 daqiqadan keyin qayta urining.",
    };
    await ctx.reply(messages[result.reason]);
    return;
  }

  await ctx.reply(
    `✅ Muvaffaqiyatli bog'landingiz, ${result.user.ism}!\n\n${await buyruqlarRoyxati(result.user)}`
  );
});

bot.command("kirim", tenantHandler((ctx, user) => startTransactionFlow(ctx, user, "kirim"), { yozish: true }));
bot.command("chiqim", tenantHandler((ctx, user) => startTransactionFlow(ctx, user, "chiqim"), { yozish: true }));

bot.command("hisobot", tenantHandler((ctx) => startMonthlyReport(ctx), { managerOnly: true }));

bot.command(
  "lead",
  tenantHandler(async (ctx, user) => {
    // CRM moduli yoqiq va rol matritsasida ruxsat bo'lishi shart.
    const crm = modulByCode("CRM");
    if (!crm?.rollar.includes(user.rol as never)) {
      await ctx.reply("Bu buyruq sizning rolingizga ochiq emas.");
      return;
    }
    if (!(await isModuleOnForTenant(user.tenantId!, "CRM"))) {
      await ctx.reply("CRM moduli yoqilmagan. Veb-saytda Sozlamalar → Modullar bo'limidan yoqing (PRO tarif).");
      return;
    }
    await startLeadFlow(ctx, user);
  })
);

/** OMBOR moduli yoqiqligini tekshiradi (avto buyruqlari shu modulga tegishli). */
async function omborKerak(ctx: Context, user: User): Promise<boolean> {
  if (await isModuleOnForTenant(user.tenantId!, "OMBOR")) return true;
  await ctx.reply("Ombor/Avtopark moduli yoqilmagan. Veb-saytda Sozlamalar → Modullar bo'limidan yoqing.");
  return false;
}

bot.command(
  "mashina",
  tenantHandler(
    async (ctx, user) => {
      if (!(await omborKerak(ctx, user))) return;
      await startMashinaFlow(ctx, user);
    },
    { managerOnly: true, yozish: true }
  )
);

bot.command(
  "xarajat",
  tenantHandler(
    async (ctx, user) => {
      if (!(await omborKerak(ctx, user))) return;
      await startXarajatFlow(ctx, user);
    },
    { managerOnly: true, yozish: true }
  )
);

bot.command(
  "sotish",
  tenantHandler(
    async (ctx, user) => {
      if (!(await omborKerak(ctx, user))) return;
      await startSotishFlow(ctx, user);
    },
    { managerOnly: true, yozish: true }
  )
);

bot.command("bekor", async (ctx) => {
  await clearAllFlows(String(ctx.chat.id));
  await ctx.reply("Amal bekor qilindi.");
});

bot.callbackQuery(/^lbiz:/, tenantHandler((ctx) => handleLeadBusinessCallback(ctx)));

// Avto: mashina qabul qilish va xarajat yozish (faqat direktor/administrator).
bot.callbackQuery(
  /^amb:/,
  tenantHandler((ctx) => handleMashinaBusinessCallback(ctx), { managerOnly: true, yozish: true })
);
bot.callbackQuery(
  /^mtol:/,
  tenantHandler((ctx, user) => handleMashinaTolovCallback(ctx, user), { managerOnly: true, yozish: true })
);
bot.callbackQuery(
  /^axb:/,
  tenantHandler((ctx) => handleXarajatBusinessCallback(ctx), { managerOnly: true, yozish: true })
);
bot.callbackQuery(
  /^axm:/,
  tenantHandler((ctx) => handleXarajatMashinaCallback(ctx), { managerOnly: true, yozish: true })
);
bot.callbackQuery(
  /^axt:/,
  tenantHandler((ctx) => handleXarajatTuriCallback(ctx), { managerOnly: true, yozish: true })
);
bot.callbackQuery(
  /^sxb:/,
  tenantHandler((ctx) => handleSotishBusinessCallback(ctx), { managerOnly: true, yozish: true })
);
bot.callbackQuery(
  /^sxm:/,
  tenantHandler((ctx) => handleSotishMashinaCallback(ctx), { managerOnly: true, yozish: true })
);
bot.callbackQuery(
  /^stol:/,
  tenantHandler((ctx, user) => handleSotishTolovCallback(ctx, user), { managerOnly: true, yozish: true })
);
bot.callbackQuery(/^biz:/, tenantHandler((ctx) => handleBusinessCallback(ctx), { yozish: true }));
bot.callbackQuery(/^cat:/, tenantHandler((ctx) => handleCategoryCallback(ctx), { yozish: true }));
bot.callbackQuery(/^sana:/, tenantHandler((ctx) => handleDateCallback(ctx), { yozish: true }));

bot.callbackQuery(
  /^rbiz:/,
  tenantHandler((ctx) => handleReportBusinessCallback(ctx), { managerOnly: true })
);

bot.callbackQuery(/^izoh:skip$/, tenantHandler((ctx, user) => handleSkipIzohCallback(ctx, user), { yozish: true }));

bot.callbackQuery(
  /^report:(pdf|excel):([^:]+):(.+)$/,
  tenantHandler(
    async (ctx) => {
      const match = ctx.callbackQuery!.data!.match(/^report:(pdf|excel):([^:]+):(.+)$/);
      if (!match) return;
      const [, format, businessId, month] = match;
      await sendReportDocument(ctx, businessId, month, format as "pdf" | "excel");
    },
    { managerOnly: true }
  )
);

bot.on(
  "message:text",
  // Matn xabarlari oqim davomi (lead yoki kirim/chiqim) — yozish hisoblanadi.
  tenantHandler(
    async (ctx, user) => {
      if (await handleLeadText(ctx, user)) return;
      // Avto oqimi va «xarajat: ...» tez buyrug'i — faol kirim/chiqim oqimiga aralashmaydi.
      if (await handleAvtoText(ctx, user)) return;
      await handleFlowText(ctx, user);
    },
    { yozish: true }
  )
);

bot.catch((err) => {
  console.error("Bot xatosi:", err);
});
