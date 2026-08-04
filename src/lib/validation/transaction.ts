import { z } from "zod";

export const createTransactionSchema = z.object({
  turi: z.enum(["kirim", "chiqim"]),
  categoryId: z.string().min(1),
  summa: z.number().int().positive("Summa musbat bo'lishi kerak"),
  sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda"),
  /** Qaysi kassaga tushdi. Berilmasa birinchi faol kassa olinadi. */
  accountId: z.string().min(1).optional().nullable(),
  izoh: z.string().max(500).optional().nullable(),
  filial: z.string().max(100).optional().nullable(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
