import { z } from "zod";

export const createProductSchema = z.object({
  nomi: z.string().min(1, "Nomi kiritilishi shart").max(100),
  kelganNarx: z.number().int().min(0).optional(),
  sotuvNarx: z.number().int().min(0).optional(),
});

export const updateProductSchema = z.object({
  nomi: z.string().min(1).max(100).optional(),
  kelganNarx: z.number().int().min(0).optional(),
  sotuvNarx: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const bulkProductsSchema = z.object({
  mahsulotlar: z.array(createProductSchema).min(1, "Kamida bitta mahsulot").max(50),
});

export const stockEntrySchema = z.object({
  productId: z.string().min(1),
  miqdor: z.number().int().positive("Miqdor musbat bo'lishi kerak"),
  birlikNarx: z.number().int().min(0).optional(),
  izoh: z.string().max(500).optional().nullable(),
});

export const createSaleSchema = z.object({
  productId: z.string().min(1),
  miqdor: z.number().int().positive("Miqdor musbat bo'lishi kerak"),
  tolovTuri: z.enum(["naqd", "qarz"]),
  mijozNomi: z.string().max(100).optional().nullable(),
  mijozTel: z.string().max(50).optional().nullable(),
});

export const debtPaymentSchema = z.object({
  summa: z.number().int().positive("Summa musbat bo'lishi kerak"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type BulkProductsInput = z.infer<typeof bulkProductsSchema>;
export type StockEntryInput = z.infer<typeof stockEntrySchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type DebtPaymentInput = z.infer<typeof debtPaymentSchema>;
