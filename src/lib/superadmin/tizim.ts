import { rawPrisma } from "@/lib/db/rawPrisma";
import { qollanganMigratsiyaSoni } from "@/lib/db/migratsiyaSoni";
import { isPostgres } from "@/lib/db/dialect";
import { requestCache } from "@/lib/requestCache";

/**
 * TIZIM SOG'LIG'I (talab 27-30).
 *
 * MUHIM PRINSIP: SOXTA MONITORING YARATILMAYDI. Bu platformada Redis, navbat
 * (queue) va alohida obyekt saqlagich YO'Q — ular uchun "HEALTHY" yozib
 * qo'yish yolg'on bo'lardi. Shuning uchun mavjud bo'lmagan komponent
 * `SOZLANMAGAN` holati bilan ochiq ko'rsatiladi.
 *
 * Har tekshiruv YENGIL: bitta `COUNT(*)` yoki env o'qish. Panel ochilishi
 * bazaga yuk bermasligi kerak.
 */

export type SoglikHolat = "SOG'LOM" | "OGOHLANTIRISH" | "KRITIK" | "SOZLANMAGAN";

export interface KomponentSoglik {
  kalit: string;
  nomi: string;
  holat: SoglikHolat;
  /** Qisqa izoh — nima aniqlandi. */
  izoh: string;
  /** Kechikish (ms) — o'lchangan bo'lsa. */
  kechikish?: number | null;
}

/** Sir (token/parol) OSHKOR QILINMAYDI — faqat "sozlanganmi" degan javob. */
function envSozlangan(...kalitlar: string[]): boolean {
  return kalitlar.every((k) => {
    const v = process.env[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

async function bazaSoglik(): Promise<KomponentSoglik> {
  const boshlandi = Date.now();
  try {
    await rawPrisma.tenant.count();
    const kechikish = Date.now() - boshlandi;
    return {
      kalit: "baza",
      nomi: "Ma'lumotlar bazasi",
      holat: kechikish > 2000 ? "OGOHLANTIRISH" : "SOG'LOM",
      izoh: `${isPostgres(process.env.DATABASE_URL ?? "") ? "PostgreSQL" : "SQLite/libSQL"} · ${kechikish} ms`,
      kechikish,
    };
  } catch (error) {
    return {
      kalit: "baza",
      nomi: "Ma'lumotlar bazasi",
      holat: "KRITIK",
      izoh: error instanceof Error ? error.message : "Ulanib bo'lmadi",
      kechikish: null,
    };
  }
}

async function migratsiyaSoglik(): Promise<KomponentSoglik> {
  const soni = await qollanganMigratsiyaSoni();
  if (soni === null) {
    return {
      kalit: "migratsiya",
      nomi: "Migratsiyalar",
      holat: "OGOHLANTIRISH",
      izoh: "Qo'llangan migratsiyalar soni aniqlanmadi",
    };
  }
  return {
    kalit: "migratsiya",
    nomi: "Migratsiyalar",
    holat: "SOG'LOM",
    izoh: `${soni} ta migratsiya qo'llangan`,
  };
}

/** Zaxira holati — `AppSetting` dagi cron belgisi orqali (lib/cron/ishlar.ts). */
async function zaxiraSoglik(now: Date): Promise<KomponentSoglik> {
  if (!envSozlangan("TELEGRAM_BOT_TOKEN", "BACKUP_CHAT_ID")) {
    return {
      kalit: "zaxira",
      nomi: "Zaxira (backup)",
      holat: "SOZLANMAGAN",
      izoh: "Telegram zaxira kanali sozlanmagan — kunlik zaxira yuborilmaydi",
    };
  }
  // Belgini `lib/cron/ishlar.ts` dagi `cronBelgisi("backup")` qo'yadi.
  const belgi = await rawPrisma.appSetting.findUnique({ where: { key: "cron:backup" } });
  if (!belgi) {
    return {
      kalit: "zaxira",
      nomi: "Zaxira (backup)",
      holat: "OGOHLANTIRISH",
      izoh: "Hali birorta zaxira qayd etilmagan",
    };
  }
  const oxirgi = new Date(belgi.value);
  const soat = (now.getTime() - oxirgi.getTime()) / 3_600_000;
  return {
    kalit: "zaxira",
    nomi: "Zaxira (backup)",
    holat: soat > 48 ? "KRITIK" : soat > 26 ? "OGOHLANTIRISH" : "SOG'LOM",
    izoh: `Oxirgi zaxira: ${oxirgi.toISOString().slice(0, 16).replace("T", " ")} (${Math.round(soat)} soat oldin)`,
  };
}

/** Cron — oxirgi ishga tushish belgisi bo'yicha. */
async function cronSoglik(now: Date): Promise<KomponentSoglik> {
  if (!envSozlangan("CRON_SECRET")) {
    return {
      kalit: "cron",
      nomi: "Cron ishlari",
      holat: "SOZLANMAGAN",
      izoh: "CRON_SECRET sozlanmagan — rejalashtirilgan ishlar ishga tushmaydi",
    };
  }
  const belgilar = await rawPrisma.appSetting.findMany({
    where: { key: { startsWith: "cron:" } },
    select: { key: true, value: true },
  });
  if (belgilar.length === 0) {
    return {
      kalit: "cron",
      nomi: "Cron ishlari",
      holat: "OGOHLANTIRISH",
      izoh: "Hali birorta cron ishi qayd etilmagan",
    };
  }
  const oxirgi = belgilar
    .map((b) => new Date(b.value).getTime())
    .filter((t) => Number.isFinite(t))
    .reduce((a, b) => Math.max(a, b), 0);
  const soat = (now.getTime() - oxirgi) / 3_600_000;
  return {
    kalit: "cron",
    nomi: "Cron ishlari",
    holat: soat > 48 ? "KRITIK" : soat > 26 ? "OGOHLANTIRISH" : "SOG'LOM",
    izoh: `${belgilar.length} ta ish · oxirgisi ${Math.round(soat)} soat oldin`,
  };
}

function envKomponent(
  kalit: string,
  nomi: string,
  kalitlar: string[],
  sozlanmaganIzoh: string,
  sozlanganIzoh: string
): KomponentSoglik {
  const bor = envSozlangan(...kalitlar);
  return {
    kalit,
    nomi,
    holat: bor ? "SOG'LOM" : "SOZLANMAGAN",
    izoh: bor ? sozlanganIzoh : sozlanmaganIzoh,
  };
}

export interface TizimSoglik {
  umumiy: SoglikHolat;
  komponentlar: KomponentSoglik[];
  /** Jonli build commit'i (Vercel beradi). */
  commit: string | null;
  muhit: string;
  vaqt: Date;
}

/**
 * So'rov ichida keshlangan variant: qobiq (layout) holat nuqtasini
 * ko'rsatadi, Tizim sahifasi esa to'liq ro'yxatni chiqaradi — ikkalasi
 * bitta renderda bo'lsa tekshiruvlar IKKI marta bajarilmasin.
 */
export const tizimSoglikCached = requestCache(async (_kalit: string) => tizimSoglik());

export async function tizimSoglik(now: Date = new Date()): Promise<TizimSoglik> {
  const [baza, migratsiya, zaxira, cron] = await Promise.all([
    bazaSoglik(),
    migratsiyaSoglik(),
    zaxiraSoglik(now),
    cronSoglik(now),
  ]);

  const komponentlar: KomponentSoglik[] = [
    baza,
    migratsiya,
    {
      kalit: "api",
      nomi: "API",
      holat: "SOG'LOM",
      izoh: "Bu javobning o'zi API ishlayotganini ko'rsatadi",
    },
    zaxira,
    cron,
    envKomponent(
      "telegram",
      "Telegram bot",
      ["TELEGRAM_BOT_TOKEN"],
      "Bot tokeni sozlanmagan — bildirishnomalar yuborilmaydi",
      "Bot tokeni sozlangan"
    ),
    envKomponent(
      "payme",
      "Payme",
      ["PAYME_MERCHANT_ID", "PAYME_KEY"],
      "Payme sozlanmagan — onlayn to'lov yo'q",
      "Payme sozlangan"
    ),
    envKomponent(
      "click",
      "Click",
      ["CLICK_SERVICE_ID", "CLICK_SECRET_KEY"],
      "Click sozlanmagan — onlayn to'lov yo'q",
      "Click sozlangan"
    ),
    envKomponent(
      "saqlagich",
      "Fayl saqlagich",
      ["BLOB_READ_WRITE_TOKEN"],
      "Saqlagich sozlanmagan — fayllar tashqi havola bilan ishlaydi",
      "Saqlagich sozlangan"
    ),
    // Redis va navbat bu arxitekturada YO'Q — soxta "sog'lom" ko'rsatilmaydi.
    {
      kalit: "redis",
      nomi: "Redis / navbat",
      holat: "SOZLANMAGAN",
      izoh: "Bu arxitekturada ishlatilmaydi: rate limit bazada, cron Vercel jadvalida",
    },
  ];

  const kritik = komponentlar.some((k) => k.holat === "KRITIK");
  const ogoh = komponentlar.some((k) => k.holat === "OGOHLANTIRISH");
  return {
    umumiy: kritik ? "KRITIK" : ogoh ? "OGOHLANTIRISH" : "SOG'LOM",
    komponentlar,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    muhit: process.env.VERCEL_ENV ?? "local",
    vaqt: now,
  };
}

export interface BazaOlchov {
  jadval: string;
  soni: number;
}

/**
 * Eng katta jadvallar bo'yicha yozuvlar soni.
 *
 * XAVFLI SO'ROVLAR UI ORQALI ISHGA TUSHIRILMAYDI (talab 28): bu yerda faqat
 * `count()` bor — ixtiyoriy SQL kiritish imkoniyati ATAYLAB berilmagan.
 */
export async function bazaOlchovlari(): Promise<BazaOlchov[]> {
  const [tenant, user, business, transaction, sale, auditLog, payment, product] = await Promise.all([
    rawPrisma.tenant.count(),
    rawPrisma.user.count(),
    rawPrisma.business.count(),
    rawPrisma.transaction.count(),
    rawPrisma.sale.count(),
    rawPrisma.auditLog.count(),
    rawPrisma.payment.count(),
    rawPrisma.product.count(),
  ]);
  return [
    { jadval: "Tenant", soni: tenant },
    { jadval: "User", soni: user },
    { jadval: "Business", soni: business },
    { jadval: "Transaction", soni: transaction },
    { jadval: "Sale", soni: sale },
    { jadval: "Product", soni: product },
    { jadval: "Payment", soni: payment },
    { jadval: "AuditLog", soni: auditLog },
  ];
}
