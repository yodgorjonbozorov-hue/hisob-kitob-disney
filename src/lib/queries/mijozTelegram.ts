import { prisma } from "@/lib/prisma";
import type { XabarTuri } from "@/lib/telegram/xabarTuri";

/**
 * MIJOZ TELEGRAM HOLATI — UI o'qish so'rovlari.
 *
 * Har so'rovda `businessId` sharti bor (tenant filtri extension'da, biznes
 * filtri bu yerda) — boshqa biznesning xabarlari ko'rinmasin.
 */

/** Buyurtma kartochkasidagi Telegram holati. */
export interface TelegramHolatDTO {
  /** "ULANMAGAN" — mijoz botga ulanmagan yoki savdoda mijoz yo'q. */
  holat: "YUBORILDI" | "XATO" | "ULANMAGAN";
  turi: XabarTuri | null;
  versiya: number | null;
  /** ISO vaqt — muvaffaqiyatli yuborilgan payt. */
  sentAt: string | null;
  xato: string | null;
}

const ULANMAGAN: TelegramHolatDTO = {
  holat: "ULANMAGAN",
  turi: null,
  versiya: null,
  sentAt: null,
  xato: null,
};

/**
 * Bir nechta chek uchun Telegram holati — BITTA so'rovda (N+1 emas).
 *
 * Holat ENG OXIRGI yozuvdan olinadi: buyurtma bo'yicha bir nechta xabar
 * bo'lishi mumkin (yaratildi → o'zgartirildi → bekor qilindi), foydalanuvchi
 * esa oxirgi natijani ko'rishi kerak.
 */
export async function chekTelegramHolatlari(
  businessId: string,
  chekIdlar: string[]
): Promise<Map<string, TelegramHolatDTO>> {
  const natija = new Map<string, TelegramHolatDTO>();
  if (chekIdlar.length === 0) return natija;

  const xabarlar = await prisma.telegramNotification.findMany({
    where: { businessId, chekId: { in: chekIdlar } },
    orderBy: { createdAt: "asc" },
    select: { chekId: true, turi: true, holat: true, versiya: true, sentAt: true, xato: true },
  });

  // `asc` tartibda yurib borib har chek uchun OXIRGI yozuv qoladi.
  for (const x of xabarlar) {
    if (!x.chekId) continue;
    natija.set(x.chekId, {
      holat: x.holat === "YUBORILDI" ? "YUBORILDI" : "XATO",
      turi: x.turi as XabarTuri,
      versiya: x.versiya,
      sentAt: x.sentAt ? x.sentAt.toISOString() : null,
      xato: x.xato,
    });
  }
  return natija;
}

/** Bitta buyurtma (chek yoki yakka sotuv) holati. */
export async function buyurtmaTelegramHolati(
  businessId: string,
  manba: { chekId?: string | null; saleId?: string | null }
): Promise<TelegramHolatDTO> {
  if (!manba.chekId && !manba.saleId) return ULANMAGAN;
  const oxirgi = await prisma.telegramNotification.findFirst({
    where: {
      businessId,
      ...(manba.chekId ? { chekId: manba.chekId } : { saleId: manba.saleId }),
    },
    orderBy: { createdAt: "desc" },
    select: { turi: true, holat: true, versiya: true, sentAt: true, xato: true },
  });
  if (!oxirgi) return ULANMAGAN;
  return {
    holat: oxirgi.holat === "YUBORILDI" ? "YUBORILDI" : "XATO",
    turi: oxirgi.turi as XabarTuri,
    versiya: oxirgi.versiya,
    sentAt: oxirgi.sentAt ? oxirgi.sentAt.toISOString() : null,
    xato: oxirgi.xato,
  };
}

/** Mijoz kartochkasidagi Telegram bloki. */
export interface MijozTelegramDTO {
  /**
   * ULANGANMI. ALOHIDA USTUN EMAS — `telegramChatId != null` dan
   * hisoblanadi (izoh: prisma/schema.prisma → Contact).
   */
  ulangan: boolean;
  username: string | null;
  ulanganAt: string | null;
  /** Faol (muddati o'tmagan) ulanish havolasi bormi. */
  kutilayotganHavola: boolean;
}

export async function mijozTelegramHolati(
  businessId: string,
  contactId: string
): Promise<MijozTelegramDTO | null> {
  const c = await prisma.contact.findFirst({
    where: { id: contactId, businessId, deletedAt: null },
    select: {
      telegramChatId: true,
      telegramUsername: true,
      telegramUlanganAt: true,
      telegramTokenExpiresAt: true,
    },
  });
  if (!c) return null;
  return {
    ulangan: c.telegramChatId !== null,
    username: c.telegramUsername,
    ulanganAt: c.telegramUlanganAt ? c.telegramUlanganAt.toISOString() : null,
    kutilayotganHavola:
      c.telegramTokenExpiresAt !== null && c.telegramTokenExpiresAt.getTime() > Date.now(),
  };
}
