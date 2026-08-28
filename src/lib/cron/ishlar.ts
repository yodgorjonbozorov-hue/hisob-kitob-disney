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

/**
 * CRON IZI (Superadmin 2.0, talab 27/29).
 *
 * Ilgari cron ishlagani yoki zaxira olingani HECH QAYERDA qayd etilmasdi:
 * "oxirgi zaxira qachon olingan?" degan savolga javob yo'q edi. Endi har ish
 * tugagach `AppSetting` ga vaqt belgisi yoziladi va Control Center → Tizim
 * sahifasi shu belgilarni ko'rsatadi.
 *
 * Yozuv MUVAFFAQIYATLI tugagandagina qo'yiladi — aks holda belgi "hammasi
 * joyida" deb yolg'on gapirardi.
 */
export async function cronBelgisi(nom: string, vaqt: Date = new Date()): Promise<void> {
  const key = `cron:${nom}`;
  try {
    await rawPrisma.appSetting.upsert({
      where: { key },
      update: { value: vaqt.toISOString() },
      create: { key, value: vaqt.toISOString() },
    });
  } catch (error) {
    console.error(`Cron belgisini yozib bo'lmadi (${nom}):`, error);
  }
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

  // Zaxira MUVAFFAQIYATLI bo'lsagina belgi qo'yiladi.
  if (zaxira.holat !== "xato") await cronBelgisi("backup");

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

  await cronBelgisi("billing");
  return { expired, eslatma: eslatma.yuborilgan, telegramsiz: eslatma.telegramsiz.length };
}

// ---------------------------------------------------------------------------
// 3. Hisobotlar (05:00)
// ---------------------------------------------------------------------------

export async function hisobotIshi() {
  const { checkAndSendMonthlyReport } = await import("@/bot/scheduler");
  const { sendDailyDigest } = await import("@/lib/reports/dailyDigest");
  const { sendKunlikEslatma } = await import("@/lib/reports/kunlikEslatma");

  const bot = await botniOl();
  // Oylik hisobot ichida "bugun 1-sanami" tekshiruvi bor.
  await xavfsiz("Oylik hisobot", () => checkAndSendMonthlyReport(bot), undefined);
  const digest = await xavfsiz("Kunlik xulosa", () => sendDailyDigest(bot.api), 0);
  // Tasdiqlanmagan kunlik yakunlar — direktorga eslatma (tasdiqlash tugmasi bilan).
  const kunlikEslatma = await xavfsiz("Kunlik tasdiqlash eslatmasi", () => sendKunlikEslatma(bot.api), 0);

  await cronBelgisi("hisobot");
  return { digest, kunlikEslatma };
}

// ---------------------------------------------------------------------------
// 4. Takroriylar va vazifalar (06:00)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 5. Davomat: kelmaganlarni belgilash (01:00 Toshkent = 20:00 UTC)
// ---------------------------------------------------------------------------

/**
 * O'tgan Toshkent kuni bo'yicha: jadvalda ish kuni bo'lgan, lekin davomat
 * yozuvi yo'q xodimlar "kelmadi" deb belgilanadi va (qoida bo'lsa) KUTILMOQDA
 * jarima ochiladi. Kun tugagach ishlaydi — xodim erta "kelmadi" bo'lib
 * qolmaydi; dam olish kuni hech qachon "kelmadi" bo'lmaydi. Idempotent.
 */
export async function davomatIshi() {
  const { isModuleOnForTenant } = await import("@/lib/modules/guard");
  const { kelmaganlarniBelgila } = await import("@/lib/services/davomat");
  const { toshkentSana } = await import("@/lib/davomat/vaqt");
  const { prisma } = await import("@/lib/prisma");

  // Kecha (Toshkent bo'yicha): cron yarim tundan keyin ishlaydi.
  const kecha = toshkentSana(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const natija = await tenantlarBoylab(async (tenantId) => {
    if (!(await isModuleOnForTenant(tenantId, "HR"))) return 0;
    // Tenant kontekstidamiz — tenant-scoped prisma bizneslarni beradi.
    const bizneslar = await prisma.business.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    let jami = 0;
    for (const biznes of bizneslar) {
      const { belgilandi } = await kelmaganlarniBelgila(biznes.id, kecha);
      jami += belgilandi;
    }
    return jami;
  }, "Davomat kelmaganlar");

  await cronBelgisi("davomat");
  return { sana: kecha, belgilandi: natija.jami, xato: natija.xato };
}

export async function vazifaIshi() {
  const { generateDueRecurring } = await import("@/lib/services/recurring");
  const { sendTaskReminders } = await import("@/lib/tasks/service");

  const recurring = await tenantlarBoylab(() => generateDueRecurring(), "Takroriy tranzaksiya");

  const bot = await botniOl();
  const eslatma = await xavfsiz("Vazifa eslatmalari", () => sendTaskReminders(bot.api), 0);

  await cronBelgisi("vazifa");
  return { recurring: recurring.jami, recurringXato: recurring.xato, eslatma };
}
