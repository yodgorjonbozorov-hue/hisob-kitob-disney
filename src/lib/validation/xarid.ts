import { z } from "zod";

/** Buyurtma holatlari — oqim: qoralama → tasdiqlangan → qabul_qilingan (yoki bekor). */
export const XARID_HOLATLARI = ["qoralama", "tasdiqlangan", "qabul_qilingan", "bekor"] as const;
export type XaridHolat = (typeof XARID_HOLATLARI)[number];

export const HOLAT_NOMI: Record<XaridHolat, string> = {
  qoralama: "Qoralama",
  tasdiqlangan: "Tasdiqlangan",
  qabul_qilingan: "Qabul qilingan",
  bekor: "Bekor qilingan",
};

export const createSupplierSchema = z.object({
  nomi: z.string().trim().min(1, "Ta'minotchi nomi kiritilishi shart").max(120),
  tel: z.string().trim().max(50).optional().nullable(),
  manzil: z.string().trim().max(200).optional().nullable(),
  izoh: z.string().trim().max(500).optional().nullable(),
  /// Tizim foydalanuvchisiga bog'lash (PRO) — to'lovlar uning kassasiga tushadi.
  userId: z.string().optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const satrSchema = z.object({
  productId: z.string().min(1),
  miqdor: z.number().int().positive("Miqdor musbat bo'lishi kerak"),
  birlikNarx: z.number().int().min(0, "Narx manfiy bo'lmasligi kerak"),
});

export const createOrderSchema = z.object({
  supplierId: z.string().min(1, "Ta'minotchini tanlang"),
  sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda"),
  tolovTuri: z.enum(["naqd", "qarz"]),
  izoh: z.string().trim().max(500).optional().nullable(),
  satrlar: z.array(satrSchema).min(1, "Kamida bitta satr kerak").max(100),
});

/** Buyurtmani tahrirlash — faqat qoralama holatida. */
export const updateOrderSchema = z.object({
  supplierId: z.string().min(1).optional(),
  sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tolovTuri: z.enum(["naqd", "qarz"]).optional(),
  izoh: z.string().trim().max(500).optional().nullable(),
  satrlar: z.array(satrSchema).min(1).max(100).optional(),
});

/** Holatni o'zgartirish (tasdiqlash, qabul qilish, bekor qilish). */
export const orderHolatSchema = z.object({
  holat: z.enum(["tasdiqlangan", "qabul_qilingan", "bekor"]),
  /** Qabul qilishda — haqiqiy qabul sanasi (berilmasa bugun). */
  qabulSana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  /**
   * QISMAN TO'LOV (PRO): qabul paytida to'lanadigan qism.
   * Berilmasa — eski xatti-harakat: naqd → to'liq to'lov, qarz → to'liq qarz.
   * 0..jamiSumma oralig'ida bo'lishi server tomonda tekshiriladi.
   */
  tolanganSumma: z.number().int().min(0).optional().nullable(),
  /** To'lov qaysi kassadan chiqadi (berilmasa — joriy userning shaxsiy/default kassasi). */
  accountId: z.string().optional().nullable(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
