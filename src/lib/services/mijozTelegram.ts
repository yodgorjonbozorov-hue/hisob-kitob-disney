import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { ForbiddenError } from "@/lib/auth/guard";
import { logAudit } from "@/lib/services/audit";

/**
 * MIJOZNI TELEGRAM BOTGA ULASH.
 *
 * OQIM: sotuvchi mijoz kartochkasida "Telegramga ulash" ni bosadi → bir
 * martalik token yaratiladi → mijozga `t.me/<bot>?start=mijoz_TOKEN` havolasi
 * (yoki QR) beriladi → mijoz bosadi → bot `/start` payload'idan tokenni oladi
 * va chatId'ni SHU kartochkaga yozadi.
 *
 * ── NEGA TOKEN, KOD EMAS ──────────────────────────────────────────────────
 * Xodimlar uchun 6 raqamli kod ishlatiladi (`/kod 123456`) — u qisqa, chunki
 * odam uni qo'lda teradi. Mijoz esa hech narsa termaydi: u havolani bosadi.
 * Shu bois token UZUN va kriptografik: 192 bit tasodif. Taxmin qilib
 * boshqa mijozning kartochkasiga ulanib olish amalda imkonsiz — spec 2
 * ("bir Telegram account tasodifan boshqa mijozga bog'lanib ketmasligi").
 *
 * ── NEGA GLOBAL UNIQUE ────────────────────────────────────────────────────
 * Bot `/start` da tenant kontekstiga EGA EMAS: uning qo'lida faqat token
 * bor. Token global takrorlanmas bo'lgani uchun u kartochkani ham, tenantni
 * ham bir o'zi aniqlaydi. Tokenlar tenant ichida takrorlansa, bot noto'g'ri
 * biznesning mijoziga ulanib cross-tenant ma'lumot ochib yuborardi (spec 12).
 *
 * ── BIR MARTALIK ──────────────────────────────────────────────────────────
 * Ulanish paytida token NULL ga tushadi. Havola boshqa odamga o'tib ketsa
 * ham ikkinchi marta ishlamaydi.
 */

/** Token amal qilish muddati: 7 kun (sotuvchi havolani SMS bilan yuboradi). */
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** `start` payload prefiksi — xodim kodidan ajratib turadi. */
export const MIJOZ_TOKEN_PREFIKS = "mijoz_";

/** 192 bit tasodif → 32 belgili base64url (Telegram `start` payload'iga sig'adi). */
function tokenYarat(): string {
  return randomBytes(24).toString("base64url");
}

/** Bot username'i env'dan (xodim ulanishi bilan bir xil manba). */
export function botUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null;
}

/** To'liq ulanish havolasi; bot username sozlanmagan bo'lsa null. */
export function ulanishHavolasi(token: string): string | null {
  const bot = botUsername();
  return bot ? `https://t.me/${bot}?start=${MIJOZ_TOKEN_PREFIKS}${token}` : null;
}

export interface UlanishNatija {
  token: string;
  /** null — TELEGRAM_BOT_USERNAME sozlanmagan (UI shuni aytadi). */
  havola: string | null;
  expiresAt: string;
}

/**
 * Mijoz uchun yangi ulanish tokeni yaratadi (eskisini bekor qiladi).
 *
 * Har chaqiruvda YANGI token: eski havola tarqalib ketgan bo'lsa ham u
 * darhol kuchini yo'qotadi.
 */
export async function ulanishTokeniYarat(
  businessId: string,
  contactId: string
): Promise<UlanishNatija> {
  const mijoz = await prisma.contact.findFirst({
    where: { id: contactId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!mijoz) throw new ForbiddenError("Mijoz topilmadi");

  const token = tokenYarat();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.contact.update({
    where: { id: contactId },
    data: { telegramToken: token, telegramTokenExpiresAt: expiresAt },
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "contact",
    entityId: contactId,
    after: { telegramToken: "yangilandi" },
  });

  return { token, havola: ulanishHavolasi(token), expiresAt: expiresAt.toISOString() };
}

/** Ulanishni uzadi (mijoz raqamini almashtirdi yoki so'radi). */
export async function telegramniUz(businessId: string, contactId: string): Promise<void> {
  const mijoz = await prisma.contact.findFirst({
    where: { id: contactId, businessId, deletedAt: null },
    select: { id: true },
  });
  if (!mijoz) throw new ForbiddenError("Mijoz topilmadi");

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      telegramChatId: null,
      telegramUsername: null,
      telegramUlanganAt: null,
      telegramToken: null,
      telegramTokenExpiresAt: null,
    },
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "contact",
    entityId: contactId,
    after: { telegram: "uzildi" },
  });
}

// ---------------------------------------------------------------------------
// BOT TOMONI — tenant konteksti YO'Q joyda ishlaydi
// ---------------------------------------------------------------------------

export type TokenNatija =
  | {
      ok: true;
      contact: { id: string; ism: string; businessId: string; tenantId: string };
    }
  | { ok: false; sabab: "not_found" | "expired" | "chat_band" };

/**
 * TOKEN BO'YICHA MIJOZNI ULAYDI (bot `/start` dan chaqiriladi).
 *
 * `rawPrisma` ATAYLAB: bot foydalanuvchini aniqlash bosqichida hali tenant
 * konteksti yo'q — bu CLAUDE.md da `src/bot/` uchun ochiq ruxsat etilgan
 * holat (`bot/auth.ts` dagi `linkByCode` bilan bir xil naqsh). Xavfsizlik
 * tokenning global unikalligiga tayanadi, kontekstga emas.
 *
 * BIR CHAT — BIR MIJOZ (biznes ichida): shu biznesda o'sha chatId boshqa
 * kartochkaga biriktirilgan bo'lsa ulanish rad etiladi. Aks holda ikki
 * mijozning xaridlari bitta odamga ketardi.
 */
export async function tokenBilanUla(
  token: string,
  chatId: string,
  username: string | null
): Promise<TokenNatija> {
  const mijoz = await rawPrisma.contact.findFirst({
    where: { telegramToken: token, deletedAt: null },
    select: {
      id: true,
      ism: true,
      businessId: true,
      telegramTokenExpiresAt: true,
      business: { select: { tenantId: true } },
    },
  });
  if (!mijoz) return { ok: false, sabab: "not_found" };
  if (!mijoz.telegramTokenExpiresAt || mijoz.telegramTokenExpiresAt.getTime() < Date.now()) {
    return { ok: false, sabab: "expired" };
  }

  const band = await rawPrisma.contact.findFirst({
    where: {
      businessId: mijoz.businessId,
      telegramChatId: chatId,
      deletedAt: null,
      id: { not: mijoz.id },
    },
    select: { id: true },
  });
  if (band) return { ok: false, sabab: "chat_band" };

  await rawPrisma.contact.update({
    where: { id: mijoz.id },
    data: {
      telegramChatId: chatId,
      telegramUsername: username,
      telegramUlanganAt: new Date(),
      // BIR MARTALIK: token darhol kuchini yo'qotadi.
      telegramToken: null,
      telegramTokenExpiresAt: null,
    },
  });

  return {
    ok: true,
    contact: {
      id: mijoz.id,
      ism: mijoz.ism,
      businessId: mijoz.businessId,
      tenantId: mijoz.business.tenantId,
    },
  };
}

export interface MijozChati {
  id: string;
  ism: string;
  businessId: string;
  businessNomi: string;
  tenantId: string;
}

/**
 * Shu chatId qaysi mijoz kartochkalariga ulangan.
 *
 * BIR NECHTA bo'lishi MUMKIN va bu to'g'ri: bir odam ikki xil ulgurji
 * do'kondan mol oladi. Shunda bot qaysi biznes ekanini SO'RAYDI —
 * ma'lumotlar hech qachon aralashtirilmaydi (spec 12).
 */
export async function chatMijozlari(chatId: string): Promise<MijozChati[]> {
  const rows = await rawPrisma.contact.findMany({
    where: { telegramChatId: chatId, deletedAt: null },
    select: {
      id: true,
      ism: true,
      businessId: true,
      business: { select: { nomi: true, tenantId: true, isActive: true } },
    },
    orderBy: { telegramUlanganAt: "desc" },
  });
  return rows
    .filter((r) => r.business.isActive)
    .map((r) => ({
      id: r.id,
      ism: r.ism,
      businessId: r.businessId,
      businessNomi: r.business.nomi,
      tenantId: r.business.tenantId,
    }));
}
