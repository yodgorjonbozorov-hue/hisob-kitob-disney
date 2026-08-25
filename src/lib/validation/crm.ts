import { z } from "zod";

/** CRM kunlik buyurtmalari uchun validatsiya sxemalari. */

const sanaRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Yangi buyurtma. Kategoriya — KIRIM modulidagi kategoriya id'si
 * (alohida CRM kategoriya tizimi yo'q). Summa `Int` (so'm), hech qachon float.
 */
export const buyurtmaSchema = z.object({
  nomi: z.string().trim().min(1, "Xizmat/buyurtma nomi kiritilsin").max(200),
  categoryId: z.string().trim().min(1, "Kategoriya tanlansin"),
  summa: z.number().int("Summa butun so'mda bo'lishi kerak").min(0).optional(),
  contactId: z.string().trim().optional().nullable(),
  kontaktIsm: z.string().trim().max(100).optional().nullable(),
  kontaktTel: z.string().trim().max(30).optional().nullable(),
  sana: z.string().regex(sanaRegex, "Sana YYYY-MM-DD ko'rinishida").optional().nullable(),
  muddat: z.string().regex(sanaRegex, "Muddat YYYY-MM-DD ko'rinishida").optional().nullable(),
  izoh: z.string().trim().max(1000).optional().nullable(),
  masulId: z.string().trim().optional().nullable(),
  stageId: z.string().trim().optional().nullable(),
});

/**
 * Buyurtmani tahrirlash / holatini o'zgartirish.
 * `kirimYoz` — eski xulq (WON bosqichga sudrab o'tkazganda kirim taklifi).
 */
export const buyurtmaPatchSchema = z.object({
  stageId: z.string().trim().optional(),
  kirimYoz: z.boolean().optional(),
  nomi: z.string().trim().min(1).max(200).optional(),
  summa: z.number().int().min(0).optional(),
  categoryId: z.string().trim().optional().nullable(),
  sana: z.string().regex(sanaRegex).optional().nullable(),
  izoh: z.string().trim().max(1000).optional().nullable(),
  masulId: z.string().trim().optional(),
});

/** Kirimga o'tkazish: kassa va to'lov turi ixtiyoriy. */
export const kirimgaSchema = z.object({
  accountId: z.string().trim().optional().nullable(),
  tolovTuri: z.enum(["naqd", "click", "qarz"]).optional().nullable(),
});

export type BuyurtmaInput = z.infer<typeof buyurtmaSchema>;
export type BuyurtmaPatchInput = z.infer<typeof buyurtmaPatchSchema>;
