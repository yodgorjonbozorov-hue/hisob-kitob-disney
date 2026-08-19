import { z } from "zod";
import { POS_TOLOV_TURLARI } from "@/lib/services/pos";

/**
 * MAGAZIN (POS) validatsiyasi.
 *
 * Barcha yozish amallari — CLAUDE.md qoidasi bo'yicha — shu yerdan o'tadi.
 */

/** Skanerdan/kameradan kelgan kod. Uzunlik cheklovi — DoS va axlat kirishga qarshi. */
export const kodQidirSchema = z.object({
  kod: z.string().trim().min(1, "Kod bo'sh").max(128, "Kod juda uzun"),
});

/** Savatdagi bitta satr. */
export const posSatrSchema = z.object({
  productId: z.string().min(1),
  miqdor: z.number().int().positive("Miqdor musbat bo'lishi kerak").max(1_000_000),
  /** Kassir tuzatgan birlik narxi (katalogga qayta yozilmaydi). */
  narx: z.number().int().positive().optional().nullable(),
});

export const posSotuvSchema = z
  .object({
    // 200 satr — bitta chek uchun real chegara; undan ko'pi xato yoki hujum.
    satrlar: z.array(posSatrSchema).min(1, "Savat bo'sh").max(200, "Savatda juda ko'p satr"),
    tolovTuri: z.enum(POS_TOLOV_TURLARI),
    accountId: z.string().min(1).optional().nullable(),
    contactId: z.string().min(1).optional().nullable(),
    mijozNomi: z.string().max(100).optional().nullable(),
    mijozTel: z.string().max(50).optional().nullable(),
    sana: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda")
      .optional()
      .nullable(),
  })
  .refine((d) => d.tolovTuri !== "qarz" || !!d.mijozNomi?.trim(), {
    message: "Qarzga sotishda mijoz nomi kiritilishi shart",
    path: ["mijozNomi"],
  });

/** Chekni qaytarish — sabab MAJBURIY (audit uchun, sotuvni bekor qilish bilan bir xil qoida). */
export const posChekBekorSchema = z.object({
  sabab: z.string().trim().min(3, "Qaytarish sababini yozing").max(300),
});

/** Shtrix-kod biriktirish. Bo'sh satr — kodni olib tashlash. */
export const barcodeSchema = z.object({
  barcode: z.string().trim().max(64).optional().nullable(),
});

export type PosSotuvInput = z.infer<typeof posSotuvSchema>;
export type PosChekBekorInput = z.infer<typeof posChekBekorSchema>;
