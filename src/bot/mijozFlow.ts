import type { Context } from "grammy";
import { prisma } from "@/lib/prisma";
import { runWithTenant } from "@/lib/db/tenantContext";
import { formatSom } from "@/lib/format";
import { chatMijozlari, tokenBilanUla, MIJOZ_TOKEN_PREFIKS, type MijozChati } from "@/lib/services/mijozTelegram";
import { chekBuyurtmasi, mijozJoriyQarzi, sotuvBuyurtmasi } from "@/lib/telegram/buyurtma";
import { royxatQatori, sanaMatni, xaridXabari } from "@/lib/telegram/mijozXabar";
import { rateLimit } from "@/lib/rateLimit";

/**
 * MIJOZ BOTI — xaridor bilan suhbat (xodim oqimlaridan MUTLAQO ajratilgan).
 *
 * ── NEGA ALOHIDA OQIM ─────────────────────────────────────────────────────
 * Botdagi mavjud handlerlar `tenantHandler` orqali o'tadi: u chatId'ni
 * XODIM (`User`) deb qidiradi va topmasa "Avval /kod orqali ulaning" deydi.
 * Mijoz esa xodim emas — uning kartochkasi `Contact`. Shu bois mijoz
 * xabarlari xodim oqimlaridan OLDIN ushlanadi va u yerga umuman tushmaydi.
 *
 * USTUVORLIK: chat XODIMNIKI bo'lsa mijoz oqimi ishlamaydi. Bitta odam ham
 * xodim, ham mijoz bo'lib qolsa xodim ekrani ustun turadi (avvalgi
 * xatti-harakat o'zgarmasin).
 *
 * ── MULTI-TENANT (spec 12) ────────────────────────────────────────────────
 * Bitta Telegram hisobi BIR NECHTA biznesning mijozi bo'lishi mumkin. Shunda
 * bot qaysi biznes ekanini SO'RAYDI va tanlangan mijoz kartochkasi bo'yicha
 * ishlaydi. Har o'qish `runWithTenant(...)` ichida va `businessId` sharti
 * bilan bajariladi — bir biznesning mijozi ikkinchisining ma'lumotini
 * ko'ra olmaydi.
 */

/** Menyu tugmalari (reply keyboard) — spec 11. */
const TUGMA_XARIDLAR = "📦 Oxirgi xaridlar";
const TUGMA_QARZ = "📕 Mening qarzim";

/** Ro'yxatda nechta oxirgi xarid ko'rsatiladi. */
const XARID_LIMIT = 10;

/** Bir chatdan 10 daqiqada nechta token sinab ko'rish mumkin (taxminga qarshi). */
const TOKEN_LIMIT = 10;
const TOKEN_OYNA_MS = 10 * 60 * 1000;

/** Buyurtma manbai: chek (ko'p mahsulotli) yoki yakka sotuv. */
type Manba = "c" | "s";

function menyuKlaviaturasi() {
  return {
    keyboard: [[{ text: TUGMA_XARIDLAR }], [{ text: TUGMA_QARZ }]],
    resize_keyboard: true,
  };
}

/** Bir nechta biznes bo'lsa — qaysi do'kon ekanini so'raydi. */
function biznesKlaviaturasi(mijozlar: MijozChati[], amal: "x" | "q") {
  return {
    inline_keyboard: mijozlar.map((m) => [
      { text: m.businessNomi, callback_data: `mx:${amal}:${m.id}` },
    ]),
  };
}

// ---------------------------------------------------------------------------
// /start — ulanish va menyu
// ---------------------------------------------------------------------------

/**
 * `/start mijoz_TOKEN` ni ushlaydi.
 *
 * `true` qaytsa xabar TO'LIQ ishlandi va xodim oqimiga o'tmaydi.
 */
export async function mijozStartUrin(ctx: Context, payload: string): Promise<boolean> {
  if (!payload.startsWith(MIJOZ_TOKEN_PREFIKS)) return false;

  const chatId = String(ctx.chat!.id);
  const rl = await rateLimit(`tgmijoz:${chatId}`, TOKEN_LIMIT, TOKEN_OYNA_MS);
  if (!rl.ok) {
    await ctx.reply("Juda ko'p urinish. 10 daqiqadan keyin qayta urining.");
    return true;
  }

  const token = payload.slice(MIJOZ_TOKEN_PREFIKS.length);
  const natija = await tokenBilanUla(token, chatId, ctx.from?.username ?? null);

  if (!natija.ok) {
    const xabarlar: Record<string, string> = {
      not_found: "Havola yaroqsiz. Sotuvchidan yangi havola so'rang.",
      expired: "Havola muddati o'tgan. Sotuvchidan yangi havola so'rang.",
      chat_band:
        "Bu Telegram hisobi shu do'konda boshqa mijozga bog'langan. Sotuvchiga murojaat qiling.",
    };
    await ctx.reply(xabarlar[natija.sabab]);
    return true;
  }

  await ctx.reply(
    `✅ Ulandingiz, ${natija.contact.ism}!\n\n` +
      "Endi har xaridingiz shu yerga avtomatik keladi: mahsulotlar, narx, to'lov va qarz.\n\n" +
      "Quyidagi tugmalardan foydalaning.",
    { reply_markup: menyuKlaviaturasi() }
  );
  return true;
}

/**
 * Ulangan mijozga menyuni ko'rsatadi (payloadsiz `/start`).
 * `false` — bu chat mijoz emas, xodim oqimiga o'tsin.
 */
export async function mijozMenyusiniKorsat(ctx: Context): Promise<boolean> {
  const mijozlar = await chatMijozlari(String(ctx.chat!.id));
  if (mijozlar.length === 0) return false;

  const kim = mijozlar.map((m) => `• ${m.businessNomi}`).join("\n");
  await ctx.reply(
    `Salom, ${mijozlar[0].ism}!\n\nSiz quyidagi do'kon(lar)ning mijozisiz:\n${kim}`,
    { reply_markup: menyuKlaviaturasi() }
  );
  return true;
}

// ---------------------------------------------------------------------------
// Menyu amallari
// ---------------------------------------------------------------------------

/**
 * Mijozdan kelgan matnni ishlaydi.
 * `false` — bu chat mijoz emas (yoki tugma emas), xodim oqimiga o'tsin.
 */
export async function mijozMatniniUrin(ctx: Context): Promise<boolean> {
  const matn = ctx.message?.text?.trim();
  if (matn !== TUGMA_XARIDLAR && matn !== TUGMA_QARZ) return false;

  const mijozlar = await chatMijozlari(String(ctx.chat!.id));
  if (mijozlar.length === 0) return false;

  const amal = matn === TUGMA_XARIDLAR ? "x" : "q";
  if (mijozlar.length > 1) {
    await ctx.reply("Qaysi do'kon bo'yicha?", {
      reply_markup: biznesKlaviaturasi(mijozlar, amal),
    });
    return true;
  }

  if (amal === "x") await xaridlarniYubor(ctx, mijozlar[0]);
  else await qarzniYubor(ctx, mijozlar[0]);
  return true;
}

/**
 * `mx:` bilan boshlanadigan tugma bosilishi.
 *
 * Formatlar:
 *   mx:x:<contactId>          — oxirgi xaridlar;
 *   mx:q:<contactId>          — joriy qarz;
 *   mx:c:<contactId>:<chekId> — chek tafsiloti;
 *   mx:s:<contactId>:<saleId> — yakka sotuv tafsiloti.
 *
 * `contactId` HAR DOIM callback ichida: keyingi qadam qaysi mijoz/biznes
 * ekanini SHU YERDAN oladi va yana `chatMijozlari` bilan TEKSHIRADI. Ya'ni
 * begona `contactId` yozib yuborilsa ham hech narsa ochilmaydi.
 */
export async function mijozCallbackUrin(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("mx:")) return false;

  const [, amal, contactId, buyurtmaId] = data.split(":");
  const mijozlar = await chatMijozlari(String(ctx.chat!.id));
  const mijoz = mijozlar.find((m) => m.id === contactId);
  if (!mijoz) {
    await ctx.answerCallbackQuery({ text: "Ulanish topilmadi. /start bosing." });
    return true;
  }

  await ctx.answerCallbackQuery();
  if (amal === "x") await xaridlarniYubor(ctx, mijoz);
  else if (amal === "q") await qarzniYubor(ctx, mijoz);
  else if ((amal === "c" || amal === "s") && buyurtmaId) {
    await tafsilotniYubor(ctx, mijoz, amal as Manba, buyurtmaId);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Ma'lumot o'qish — hammasi tenant konteksti va `businessId` sharti ostida
// ---------------------------------------------------------------------------

interface XaridQatori {
  manba: Manba;
  id: string;
  sana: Date;
  summa: number;
}

/**
 * OXIRGI XARIDLAR (spec 11).
 *
 * Balansa'da savdo ikki shaklda bo'ladi, shuning uchun ikkovi ham o'qiladi
 * va sana bo'yicha birlashtiriladi:
 *   PosChek — ko'p mahsulotli chek;
 *   Sale (chekId = null) — yakka sotuv.
 * Bekor qilinganlari CHIQMAYDI: mijoz uchun ular xarid emas.
 */
async function oxirgiXaridlar(mijoz: MijozChati): Promise<XaridQatori[]> {
  return runWithTenant(mijoz.tenantId, async () => {
    const [cheklar, sotuvlar] = await Promise.all([
      prisma.posChek.findMany({
        where: { businessId: mijoz.businessId, contactId: mijoz.id, deletedAt: null },
        orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
        take: XARID_LIMIT,
        select: { id: true, sana: true, jamiSumma: true },
      }),
      prisma.sale.findMany({
        where: {
          businessId: mijoz.businessId,
          contactId: mijoz.id,
          deletedAt: null,
          chekId: null,
        },
        orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
        take: XARID_LIMIT,
        select: { id: true, sana: true, jamiSumma: true },
      }),
    ]);

    const qatorlar: XaridQatori[] = [
      ...cheklar.map((c) => ({ manba: "c" as Manba, id: c.id, sana: c.sana, summa: c.jamiSumma })),
      ...sotuvlar.map((s) => ({ manba: "s" as Manba, id: s.id, sana: s.sana, summa: s.jamiSumma })),
    ];
    qatorlar.sort((a, b) => b.sana.getTime() - a.sana.getTime());
    return qatorlar.slice(0, XARID_LIMIT);
  });
}

async function xaridlarniYubor(ctx: Context, mijoz: MijozChati): Promise<void> {
  const qatorlar = await oxirgiXaridlar(mijoz);
  if (qatorlar.length === 0) {
    await ctx.reply(`${mijoz.businessNomi}: hali xaridingiz yo'q.`);
    return;
  }
  await ctx.reply(`📦 ${mijoz.businessNomi} — oxirgi xaridlaringiz:`, {
    reply_markup: {
      inline_keyboard: qatorlar.map((q) => [
        {
          text: royxatQatori(q.sana, q.summa),
          callback_data: `mx:${q.manba}:${mijoz.id}:${q.id}`,
        },
      ]),
    },
  });
}

/**
 * MENING QARZIM (spec 11) — real vaqtda bazadan.
 *
 * Qoldiq `lib/telegram/buyurtma.ts` dagi `mijozJoriyQarzi` orqali, ya'ni
 * butun tizim ishlatadigan O'SHA ledger kesimidan. Bot uchun alohida
 * hisoblash yo'q (spec 8).
 */
async function qarzniYubor(ctx: Context, mijoz: MijozChati): Promise<void> {
  const { qarz, oxirgiTolov } = await runWithTenant(mijoz.tenantId, async () => {
    const [q, tolov] = await Promise.all([
      mijozJoriyQarzi(mijoz.businessId, mijoz.id),
      prisma.debtPayment.findFirst({
        where: {
          businessId: mijoz.businessId,
          debt: { contactId: mijoz.id, turi: "olinadigan" },
        },
        orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
        select: { summa: true, sana: true, createdAt: true },
      }),
    ]);
    return { qarz: q, oxirgiTolov: tolov };
  });

  const qatorlar = [
    `📕 ${mijoz.businessNomi}`,
    "",
    `Joriy qarzingiz:`,
    `${formatSom(qarz)} so'm`,
  ];
  if (oxirgiTolov) {
    qatorlar.push(
      "",
      "Oxirgi to'lov:",
      sanaMatni(oxirgiTolov.sana ?? oxirgiTolov.createdAt),
      `${formatSom(oxirgiTolov.summa)} so'm`
    );
  }
  await ctx.reply(qatorlar.join("\n"));
}

/** Bitta buyurtma tafsiloti — xarid xabari bilan AYNAN bir xil formatda. */
async function tafsilotniYubor(
  ctx: Context,
  mijoz: MijozChati,
  manba: Manba,
  buyurtmaId: string
): Promise<void> {
  const buyurtma = await runWithTenant(mijoz.tenantId, () =>
    manba === "c"
      ? chekBuyurtmasi(mijoz.businessId, buyurtmaId)
      : sotuvBuyurtmasi(mijoz.businessId, buyurtmaId)
  );
  // Buyurtma boshqa mijozniki bo'lsa (soxta callback) — ochilmaydi.
  if (!buyurtma || buyurtma.mijoz.id !== mijoz.id) {
    await ctx.reply("Buyurtma topilmadi.");
    return;
  }
  await ctx.reply(xaridXabari(buyurtma));
}
