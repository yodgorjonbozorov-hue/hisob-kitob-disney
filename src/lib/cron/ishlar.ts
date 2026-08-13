import { rawPrisma } from "@/lib/db/rawPrisma";
import { runWithTenant } from "@/lib/db/tenantContext";

/**
 * CRON ISHLARI — to'rt guruhga bo'lingan.
 *
 * Ilgari hammasi bitta route'da ketma-ket bajarilardi: zaxira, obuna
 * statuslari, hisobotlar, takroriylar, eslatmalar va tozalash. 50+ tenantda
 * bu 60 soniyalik limitga urilib, oxirgi qadamlar JIMGINA bajarilmay
 * qolardi — hech kim buni sezmasdi (audit: H-12).
 *
 * Endi har guruh alohida route va alohida vaqtda ishlaydi. Bir guruh
 * yiqilsa qolgan uchtasi baribir bajariladi.
 *
 * Funksiyalar route'dan ajratilgan — shu bois testda HTTP'siz chaqiriladi.
 */

/** Bot moduli `TELEGRAM_BOT_TOKEN` ni import paytida talab qiladi — shuning uchun kech yuklanadi. */
async function botniOl() {
  const { bot } = await import("@/bot/bot");
  return bot;
}

/**
 * Har tenant ustidan aylanadi va HAR BIRINI alohida qo'riqlaydi.
 *
 * Nega muhim: bitta tenantdagi buzuq ma'lumot butun cron'ni to'xtatib
 * qo'yardi va undan keyingi barcha mijozlar xizmatsiz qolardi. Endi xato
 * log'ga chiqadi va aylanish davom etadi.
 */
export async function tenantlarBoylab(
  fn: (tenantId: string) => Promise<number>,
  nom: string
): Promise<{ jami: number; xato: number }> {
  const tenants = await rawPrisma.tenant.findMany({ select: { id: true, name: true } });
  let jami = 0;
  let xato = 0;
  for (const tenant of tenants) {
    try {
      jami += await runWithTenant(tenant.id, () => fn(tenant.id));
    } catch (error) {
      xato++;
      console.error(`${nom} xatosi (tenant: ${tenant.name}):`, error);
    }
  }
  return { jami, xato };
}

/** Xato bo'lsa log'ga yozib, zaxira qiymat qaytaradi — bitta qadam butun ishni yiqitmasin. */
async function xavfsiz<T>(nom: string, fn: () => Promise<T>, zaxira: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`${nom} xatosi:`, error);
    return zaxira;
  }
}

// ---------------------------------------------------------------------------
// 1. Zaxira va tozalash (03:00)
// ---------------------------------------------------------------------------

export async function zaxiraIshi(opts: { faqatZaxira?: boolean } = {}) {
  const { sendBackupToTelegram } = await import("@/lib/backup/send");
  // Natija matni faqat log/javob uchun — "xato" ni ham qabul qiladigan tor tur.
  const zaxira = await xavfsiz<{ holat: string }>(
    "Zaxira",
    () => sendBackupToTelegram(),
    { holat: "xato" }
  );

  if (opts.faqatZaxira) return { zaxira: zaxira.holat, suhbat: 0, rateLimit: 0 };

  const { cleanupOldConversations } = await import("@/bot/conversationStore");
  const { cleanupRateLimits } = await import("@/lib/rateLimit");

  const suhbat = await xavfsiz("Bot suhbatlarini tozalash", () => cleanupOldConversations(), 0);
  const rateLimit = await xavfsiz("Rate limit tozalash", () => cleanupRateLimits(), 0);

  return { zaxira: zaxira.holat, suhbat, rateLimit };
}

// ---------------------------------------------------------------------------
// 2. Obuna: statuslar va eslatmalar (04:00)
// ---------------------------------------------------------------------------

export async function billingIshi() {
  const { updateExpiredStatuses } = await import("@/lib/billing/subscribe");
  const { sendExpiryWarnings } = await import("@/lib/billing/notify");

  // Avval statuslar: eslatma matni yangi statusga tayanadi.
  const expired = await xavfsiz("Status yangilash", () => updateExpiredStatuses(), 0);

  const bot = await botniOl();
  const eslatma = await xavfsiz("Eslatma", () => sendExpiryWarnings(bot), {
    yuborilgan: 0,
    telegramsiz: [] as string[],
  });

  // Telegram ulanmagan mijozlarga xabar yetmaydi — qo'lda bog'lanish uchun log'ga chiqaramiz
  // (superadmin panelida ham "TG yo'q" belgisi bilan ko'rinadi).
  if (eslatma.telegramsiz.length > 0) {
    console.warn("Telegram ulanmagan (eslatma yetmadi):", eslatma.telegramsiz.join(", "));
  }

  return { expired, eslatma: eslatma.yuborilgan, telegramsiz: eslatma.telegramsiz.length };
}

// ---------------------------------------------------------------------------
// 3. Hisobotlar (05:00)
// ---------------------------------------------------------------------------

export async function hisobotIshi() {
  const { checkAndSendMonthlyReport } = await import("@/bot/scheduler");
  const { sendDailyDigest } = await import("@/lib/reports/dailyDigest");
  const { sendKunlikEslatma } = await import("@/lib/reports/kunlikEslatma");
  const { kunlikAvtoQulfla } = await import("@/lib/services/kunlik");

  const bot = await botniOl();
  // Oylik hisobot ichida "bugun 1-sanami" tekshiruvi bor.
  await xavfsiz("Oylik hisobot", () => checkAndSendMonthlyReport(bot), undefined);
  const digest = await xavfsiz("Kunlik xulosa", () => sendDailyDigest(bot.api), 0);
  // Tasdiqlanmagan kunlik yakunlar — direktorga eslatma (tasdiqlash tugmasi bilan).
  const kunlikEslatma = await xavfsiz("Kunlik tasdiqlash eslatmasi", () => sendKunlikEslatma(bot.api), 0);
  // Davr yopish (M-10): CONFIRMED bo'lganidan qulflashKun o'tgan kunlar LOCKED.
  const qulf = await tenantlarBoylab(() => kunlikAvtoQulfla(), "Kunlik avto qulflash");

  return { digest, kunlikEslatma, qulflandi: qulf.jami, qulfXato: qulf.xato };
}

// ---------------------------------------------------------------------------
// 4. Takroriylar va vazifalar (06:00)
// ---------------------------------------------------------------------------

export async function vazifaIshi() {
  const { generateDueRecurring } = await import("@/lib/services/recurring");
  const { sendTaskReminders } = await import("@/lib/tasks/service");

  const recurring = await tenantlarBoylab(() => generateDueRecurring(), "Takroriy tranzaksiya");

  const bot = await botniOl();
  const eslatma = await xavfsiz("Vazifa eslatmalari", () => sendTaskReminders(bot.api), 0);

  return { recurring: recurring.jami, recurringXato: recurring.xato, eslatma };
}
