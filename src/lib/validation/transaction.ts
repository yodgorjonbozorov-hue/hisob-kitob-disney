import { z } from "zod";

/** Tranzaksiya to'lov turlari. Null (eski yozuvlar) — kassa turidan chiqariladi. */
export const TOLOV_TURLARI = ["naqd", "click", "qarz"] as const;
export type TolovTuri = (typeof TOLOV_TURLARI)[number];

export const TOLOV_NOMI: Record<TolovTuri, string> = {
  naqd: "Naqd",
  click: "Click",
  qarz: "Qarz",
};

export const TOLOV_BELGI: Record<TolovTuri, string> = {
  naqd: "\u{1F4B5}",
  click: "\u{1F4B3}",
  qarz: "\u{1F4CB}",
};

export const createTransactionSchema = z
  .object({
    turi: z.enum(["kirim", "chiqim"]),
    categoryId: z.string().min(1),
    summa: z.number().int().positive("Summa musbat bo'lishi kerak"),
    sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda"),
    /** Qaysi kassaga tushdi. Berilmasa to'lov turiga mos faol kassa olinadi. */
    accountId: z.string().min(1).optional().nullable(),
    /** Berilmasa (eski mijozlar/import) — kassa turidan chiqariladi. */
    tolovTuri: z.enum(TOLOV_TURLARI).optional().nullable(),
    izoh: z.string().max(500).optional().nullable(),
    filial: z.string().max(100).optional().nullable(),
  })
  .refine((d) => !(d.tolovTuri === "qarz" && d.turi === "chiqim"), {
    message: "Qarz to'lov turi faqat kirim uchun",
  });

export const updateTransactionSchema = z.object({
  turi: z.enum(["kirim", "chiqim"]).optional(),
  categoryId: z.string().min(1).optional(),
  summa: z.number().int().positive("Summa musbat bo'lishi kerak").optional(),
  sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda").optional(),
  accountId: z.string().min(1).optional().nullable(),
  tolovTuri: z.enum(TOLOV_TURLARI).optional().nullable(),
  izoh: z.string().max(500).optional().nullable(),
  filial: z.string().max(100).optional().nullable(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
