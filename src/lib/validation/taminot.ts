import { z } from "zod";
import { BIRLIKLAR } from "@/lib/validation/inventory";

/**
 * TA'MINOT ("Tovar keldi") — Ombor modulining asosiy yozuv amali.
 *
 * Eski xarid oqimi uch qadamli edi: qoralama → tasdiqlangan → qabul qilingan.
 * Bu REJA bilan ishlaydigan biznes uchun to'g'ri, lekin gul do'koni yoki
 * kichik magazin uchun ortiqcha: tovar allaqachon kelgan, uni faqat yozib
 * qo'yish kerak. Shuning uchun bu sxema BIR QADAMLI: yuborilgan ta'minot
 * darhol qabul qilingan hisoblanadi va ombor o'sha zahoti oshadi.
 *
 * Eski oqim o'chirilmadi — `lib/validation/xarid.ts` o'z joyida, ikkalasi
 * ham ayni bir hisob qoidasidan (`qabulYozuvlariTx`) foydalanadi.
 */

/** UI'dagi uchta katta tugma. "karta" — Click/plastik (naqdsiz kassa). */
export const TAMINOT_TOLOV_USULLARI = ["naqd", "karta", "qarz"] as const;
export type TaminotTolovUsuli = (typeof TAMINOT_TOLOV_USULLARI)[number];

export const TAMINOT_TOLOV_NOMI: Record<TaminotTolovUsuli, string> = {
  naqd: "Naqd",
  karta: "Click / Karta",
  qarz: "Qarzga",
};

export const TAMINOT_TOLOV_BELGI: Record<TaminotTolovUsuli, string> = {
  naqd: "\u{1F4B5}",
  karta: "\u{1F4B3}",
  qarz: "\u{1F4D2}",
};

export function isTaminotTolovUsuli(v: unknown): v is TaminotTolovUsuli {
  return TAMINOT_TOLOV_USULLARI.includes(v as TaminotTolovUsuli);
}

const satrSchema = z.object({
  productId: z.string().min(1, "Mahsulotni tanlang"),
  miqdor: z.number().int().positive("Miqdor musbat bo'lishi kerak").max(10_000_000),
  // Narx 0 bo'lishi mumkin emas: 0 narxli kirim tannarx snapshotini nolga
  // tushirib, keyingi foyda hisobini buzadi.
  birlikNarx: z.number().int().positive("Narx musbat bo'lishi kerak").max(100_000_000_000),
});

export const createTaminotSchema = z.object({
  /**
   * TAKROR SAQLASHDAN HIMOYA. Frontend oqim ochilganda BIR MARTA yaratadi va
   * qayta urinishlarda O'ZGARTIRMAYDI — server ikkinchi so'rovda yangi yozuv
   * yaratmasdan mavjudini qaytaradi (`PurchaseOrder.idempotencyKey`).
   */
  idempotencyKey: z.string().trim().min(8, "Kalit qisqa").max(64),
  supplierId: z.string().min(1, "Ta'minotchini tanlang"),
  tolovUsuli: z.enum(TAMINOT_TOLOV_USULLARI),
  /** Qaysi kassadan pul chiqdi. Berilmasa usulga mos kassa avtomatik tanlanadi. */
  accountId: z.string().min(1).optional().nullable(),
  /** Tovar kelgan sana. Berilmasa — bugun. */
  sana: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD ko'rinishida bo'lishi kerak")
    .optional()
    .nullable(),
  izoh: z.string().trim().max(500).optional().nullable(),
  satrlar: z.array(satrSchema).min(1, "Kamida bitta mahsulot qo'shing").max(100),
});

export type CreateTaminotInput = z.infer<typeof createTaminotSchema>;

/** Ta'minotni bekor qilish — sabab MAJBURIY (teskari yozuvlar auditda qoladi). */
export const bekorTaminotSchema = z.object({
  sabab: z.string().trim().min(3, "Bekor qilish sababini yozing").max(300),
});

/**
 * "Tovar keldi" oqimi ichidan yangi mahsulot yaratish — minimal forma.
 * Ombor sahifasidagi "Yangi mahsulot" ham shu sxemani ishlatadi.
 */
export const omborMahsulotSchema = z.object({
  nomi: z.string().trim().min(1, "Mahsulot nomini kiriting").max(100),
  categoryId: z.string().min(1).optional().nullable(),
  birlik: z.enum(BIRLIKLAR).default("dona"),
  kelganNarx: z.number().int().min(0).max(100_000_000_000).optional(),
  sotuvNarx: z.number().int().min(0).max(100_000_000_000).optional(),
  sku: z.string().trim().max(40).optional().nullable(),
  minQoldiq: z.number().int().min(0).max(1_000_000).optional(),
  /** Mahsulot rasmi — yuklangan fayl manzili yoki tashqi havola. */
  rasmUrl: z.string().trim().max(1000).optional().nullable(),
});

export type OmborMahsulotInput = z.infer<typeof omborMahsulotSchema>;

/** Mahsulot ro'yxati filtri — server tomonda qidirish va sahifalash. */
export const OMBOR_HOLATLARI = ["barchasi", "kam", "tugagan"] as const;
export type OmborHolati = (typeof OMBOR_HOLATLARI)[number];

export const omborRoyxatSchema = z.object({
  q: z.string().trim().max(100).optional().nullable(),
  categoryId: z.string().min(1).optional().nullable(),
  holat: z.enum(OMBOR_HOLATLARI).default("barchasi"),
  sahifa: z.number().int().min(1).max(1000).default(1),
  limit: z.number().int().min(1).max(100).default(24),
});

export type OmborRoyxatInput = z.infer<typeof omborRoyxatSchema>;
