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
  izoh: z.string().max(500).optional().nullable(),
  avtoYil: z.number().int().min(1900).max(2100).optional().nullable(),
  avtoRaqam: z.string().max(20).optional().nullable(),
  avtoRang: z.string().max(30).optional().nullable(),
});

/** Avto rejimi — avtoparkka mashina qabul qilish. */
export const createAvtoSchema = z
  .object({
    nomi: z.string().min(1, "Model kiritilishi shart").max(100),
    olinganNarx: z.number().int().positive("Olingan narx kiritilishi shart"),
    sotuvNarx: z.number().int().min(0).optional(),
    avtoYil: z.number().int().min(1900, "Yil noto'g'ri").max(2100, "Yil noto'g'ri").optional().nullable(),
    avtoRaqam: z.string().max(20).optional().nullable(),
    avtoRang: z.string().max(30).optional().nullable(),
    izoh: z.string().max(500).optional().nullable(),
    tolovTuri: z.enum(["naqd", "qarz"]),
    egasiNomi: z.string().max(100).optional().nullable(),
    egasiTel: z.string().max(50).optional().nullable(),
  })
  .refine((d) => d.tolovTuri !== "qarz" || !!d.egasiNomi?.trim(), {
    message: "Qarzga olishda mashina egasining ismi kiritilishi shart",
    path: ["egasiNomi"],
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

/** Qo'lda qarzdorlik qo'shish (ikki yo'nalish). */
export const createDebtSchema = z.object({
  turi: z.enum(["olinadigan", "beriladigan"]),
  mijozNomi: z.string().min(1, "Ism kiritilishi shart").max(100),
  mijozTel: z.string().max(50).optional().nullable(),
  jamiSumma: z.number().int().positive("Summa musbat bo'lishi kerak"),
  tolangan: z.number().int().min(0).optional(),
  productId: z.string().optional().nullable(),
  // "YYYY-MM-DD" ko'rinishidagi muddat.
  muddat: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD ko'rinishida bo'lishi kerak")
    .optional()
    .nullable(),
  izoh: z.string().max(500).optional().nullable(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type BulkProductsInput = z.infer<typeof bulkProductsSchema>;
export type StockEntryInput = z.infer<typeof stockEntrySchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type DebtPaymentInput = z.infer<typeof debtPaymentSchema>;
export type CreateAvtoInput = z.infer<typeof createAvtoSchema>;
export type CreateDebtInput = z.infer<typeof createDebtSchema>;
