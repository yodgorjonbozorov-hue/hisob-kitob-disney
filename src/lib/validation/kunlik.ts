import { z } from "zod";

/**
 * KUNLIK HISOBOT — zod sxemalari va lug'atlar.
 *
 * To'lov turlari va holatlar bazada String (SQLite'da enum yo'q) —
 * cheklov shu yerda, ilova darajasida.
 */

export const KUNLIK_TOLOV_TURLARI = ["CASH", "CLICK", "DEBT"] as const;
export type KunlikTolovTuri = (typeof KUNLIK_TOLOV_TURLARI)[number];

export const KUNLIK_TOLOV_NOMI: Record<KunlikTolovTuri, string> = {
  CASH: "Naqd",
  CLICK: "Click",
  DEBT: "Qarz",
};

export const KUNLIK_TOLOV_BELGI: Record<KunlikTolovTuri, string> = {
  CASH: "\u{1F4B5}",
  CLICK: "\u{1F4B3}",
  DEBT: "\u{1F4CB}",
};

export const KUNLIK_HOLATLAR = ["OPEN", "CONFIRMED"] as const;
export type KunlikHolat = (typeof KUNLIK_HOLATLAR)[number];

const sanaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda");

const summaSchema = z
  .number({ invalid_type_error: "Summa raqam bo'lishi kerak" })
  .int("Summa butun son bo'lishi kerak (so'm)")
  .positive("Summa 0 dan katta bo'lishi kerak")
  .max(100_000_000_000, "Summa juda katta");

export const createKunlikTushumSchema = z.object({
  summa: summaSchema,
  tolovTuri: z.enum(KUNLIK_TOLOV_TURLARI, {
    errorMap: () => ({ message: "To'lov turi noto'g'ri (Naqd/Click/Qarz)" }),
  }),
  izoh: z.string().trim().max(300, "Izoh 300 belgidan oshmasin").optional(),
});
export type CreateKunlikTushumInput = z.infer<typeof createKunlikTushumSchema>;

export const updateKunlikTushumSchema = z.object({
  summa: summaSchema.optional(),
  tolovTuri: z
    .enum(KUNLIK_TOLOV_TURLARI, {
      errorMap: () => ({ message: "To'lov turi noto'g'ri (Naqd/Click/Qarz)" }),
    })
    .optional(),
  izoh: z.string().trim().max(300, "Izoh 300 belgidan oshmasin").nullable().optional(),
});
export type UpdateKunlikTushumInput = z.infer<typeof updateKunlikTushumSchema>;

/** Tasdiqlash / qayta ochish so'rovi — qaysi kun. */
export const kunlikSanaSchema = z.object({ sana: sanaSchema });
export type KunlikSanaInput = z.infer<typeof kunlikSanaSchema>;

/** Direktor tayinlash: null — direktorni olib tashlash. */
export const setKunlikDirektorSchema = z.object({
  direktorId: z.string().min(1).nullable(),
});
export type SetKunlikDirektorInput = z.infer<typeof setKunlikDirektorSchema>;
