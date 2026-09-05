/**
 * MIJOZGA YUBORILADIGAN TELEGRAM XABAR TURLARI — YAGONA MANBA.
 *
 * `TelegramNotification.turi` shu ro'yxatdan qiymat oladi. Client va server
 * ikkalasida ishlatiladi (UI ham holat yorlig'ini shu yerdan oladi) —
 * server-only import qo'shilmasin.
 */

export const XABAR_TURLARI = [
  /** Savdo yozildi — tovar mijozga berildi. */
  "SALE_CREATED",
  /** Yuborilgan savdo o'zgardi (miqdor/narx/to'lov/qarz). */
  "SALE_UPDATED",
  /** Savdo bekor qilindi / qaytarildi. */
  "SALE_CANCELLED",
  /** Qarzga to'lov qabul qilindi. */
  "PAYMENT_RECEIVED",
  /** Qarz muddati eslatmasi. */
  "DEBT_REMINDER",
] as const;

export type XabarTuri = (typeof XABAR_TURLARI)[number];

/**
 * AVTOMATIK yuboriladigan turlar.
 *
 * `PAYMENT_RECEIVED` va `DEBT_REMINDER` jurnalda va formatterda bor, lekin
 * hech qaysi savdo oqimi ularni O'ZI chaqirmaydi — ular keyingi bosqich
 * (spec: "hozircha automatic yuborilishi shart bo'lganlari" ro'yxatida yo'q).
 */
export const AVTOMATIK_TURLAR: readonly XabarTuri[] = [
  "SALE_CREATED",
  "SALE_UPDATED",
  "SALE_CANCELLED",
];

/** Yuborish holati. */
export const XABAR_HOLATLARI = ["YUBORILDI", "XATO"] as const;
export type XabarHolati = (typeof XABAR_HOLATLARI)[number];

/** UI'da ko'rinadigan qisqa nom. */
export const XABAR_TURI_NOMI: Record<XabarTuri, string> = {
  SALE_CREATED: "Xarid",
  SALE_UPDATED: "O'zgartirish",
  SALE_CANCELLED: "Bekor qilindi",
  PAYMENT_RECEIVED: "To'lov",
  DEBT_REMINDER: "Qarz eslatmasi",
};

export function isXabarTuri(v: unknown): v is XabarTuri {
  return XABAR_TURLARI.includes(v as XabarTuri);
}
