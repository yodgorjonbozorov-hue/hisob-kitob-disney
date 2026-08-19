import { z } from "zod";

export const createProductSchema = z.object({
  nomi: z.string().min(1, "Nomi kiritilishi shart").max(100),
  kelganNarx: z.number().int().min(0).optional(),
  sotuvNarx: z.number().int().min(0).optional(),
  sku: z.string().trim().max(40).optional().nullable(),
  birlik: z.string().max(20).optional(),
  minQoldiq: z.number().int().min(0).max(1_000_000).optional(),
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
  sku: z.string().trim().max(40).optional().nullable(),
  birlik: z.string().max(20).optional(),
  minQoldiq: z.number().int().min(0).max(1_000_000).optional(),
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

/** Mashina/mahsulotga xarajat qo'shish (ta'mirlash, bo'yoq, rasmiylashtirish...). */
export const createProductExpenseSchema = z.object({
  productId: z.string().min(1),
  turi: z.enum(["tamirlash", "boyoq", "yuvish", "rasmiylashtirish", "ehtiyot_qism", "boshqa"]),
  summa: z.number().int().positive("Summa musbat bo'lishi kerak"),
  izoh: z.string().max(500).optional().nullable(),
  // "naqd" — darhol chiqim tranzaksiya; "qarz" — keyin to'lanadi (beriladigan qarz).
  tolovTuri: z.enum(["naqd", "qarz"]).default("naqd"),
  // Qarzga bo'lsa — kimga to'lanishi kerak (usta/servis nomi).
  kimga: z.string().max(100).optional().nullable(),
}).refine((d) => d.tolovTuri !== "qarz" || !!d.kimga?.trim(), {
  message: "Keyin to'lanadigan bo'lsa — kimga to'lanishi yozilishi shart",
  path: ["kimga"],
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
  /** Mijoz kartochkasi (MIJOZLAR moduli). Berilsa qarz limiti tekshiriladi. */
  contactId: z.string().min(1).optional().nullable(),
  mijozNomi: z.string().max(100).optional().nullable(),
  mijozTel: z.string().max(50).optional().nullable(),
  // Kelishilgan narx (birlik) — savdolashib belgilangan haqiqiy sotuv narxi.
  narx: z.number().int().positive().optional().nullable(),
  /** Naqd sotuvda pul tushadigan kassa (naqd/Click/terminal). Berilmasa — standart kassa. */
  accountId: z.string().min(1).optional().nullable(),
  /** Sotuv sanasi. Berilmasa bugun — kechagi sotuvni ham kiritish mumkin. */
  sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda").optional().nullable(),
});

/** Sotuvni bekor qilish — sabab MAJBURIY (audit uchun). */
export const cancelSaleSchema = z.object({
  sabab: z.string().trim().min(3, "Bekor qilish sababini yozing").max(300),
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
export type CreateProductExpenseInput = z.infer<typeof createProductExpenseSchema>;
export type CreateDebtInput = z.infer<typeof createDebtSchema>;

/** O'lchov birliklari — UI va API bir xil ro'yxatdan foydalanadi. */
export const BIRLIKLAR = ["dona", "kg", "litr", "metr", "quti", "paket"] as const;
export type Birlik = (typeof BIRLIKLAR)[number];

/** Inventarizatsiya / hisobdan chiqarish. */
export const adjustStockSchema = z.object({
  productId: z.string().min(1),
  turi: z.enum(["inventarizatsiya", "chiqarish"]),
  /** Inventarizatsiyada — sanalgan qoldiq; chiqarishda — chiqariladigan miqdor. */
  miqdor: z.number().int().min(0, "Miqdor manfiy bo'lmasligi kerak"),
  sabab: z.string().trim().min(3, "Sababni yozing").max(300),
});

/**
 * MAHSULOT IMPORTI — bitta fayl qatorining sxemasi.
 *
 * `nullable` maydonlar: ustun faylda BOR, lekin katak bo'sh degani.
 * `undefined` esa ustunning o'zi yo'qligini bildiradi — yangilashda bunday
 * maydonga TEGILMAYDI (aks holda narxsiz fayl butun katalog narxini nolga
 * tushirib yuborardi).
 */
export const mahsulotImportQatorSchema = z.object({
  nomi: z.string().trim().min(1, "Nomi bo'sh").max(100),
  sku: z.string().trim().max(40).nullable().optional(),
  barcode: z.string().trim().max(64).nullable().optional(),
  kategoriya: z.string().trim().max(100).nullable().optional(),
  birlik: z.enum(BIRLIKLAR).optional(),
  kelganNarx: z.number().int().min(0, "Tannarx manfiy bo'lmasligi kerak").max(100_000_000_000).nullable().optional(),
  sotuvNarx: z.number().int().min(0, "Sotuv narxi manfiy bo'lmasligi kerak").max(100_000_000_000).nullable().optional(),
  miqdor: z.number().int().min(0, "Qoldiq manfiy bo'lmasligi kerak").max(10_000_000).nullable().optional(),
  minQoldiq: z.number().int().min(0).max(1_000_000).nullable().optional(),
  izoh: z.string().trim().max(500).nullable().optional(),
});

export type MahsulotImportQatorInput = z.infer<typeof mahsulotImportQatorSchema>;

/**
 * NARX VA QOLDIQNI OMMAVIY TO'LDIRISH (ombor jadvalidan).
 *
 * Har maydon ixtiyoriy: foydalanuvchi faqat o'zgartirgan katagi keladi.
 * `null` — "bu maydonga tegilmasin" degani, 0 esa haqiqiy qiymat.
 */
export const narxToldirishQatorSchema = z.object({
  productId: z.string().min(1),
  kelganNarx: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
  sotuvNarx: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
  miqdor: z.number().int().min(0, "Qoldiq manfiy bo'lmasligi kerak").max(10_000_000).nullable().optional(),
});

export const narxToldirishSchema = z.object({
  qatorlar: z.array(narxToldirishQatorSchema).min(1, "O'zgartirilgan qator yo'q").max(500),
});

export type NarxToldirishInput = z.infer<typeof narxToldirishSchema>;
