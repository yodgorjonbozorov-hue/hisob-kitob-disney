import { z } from "zod";

export const STAVKA_TURLARI = ["oylik", "kunlik"] as const;
export type StavkaTuri = (typeof STAVKA_TURLARI)[number];

export const STAVKA_NOMI: Record<StavkaTuri, string> = {
  oylik: "Oylik stavka",
  kunlik: "Kunlik stavka",
};

/** Davomat holatlari va ularning kun ulushi (ikkilangan: 1 kun = 2). */
export const DAVOMAT_HOLATLARI = ["keldi", "yarim", "kelmadi", "tatil"] as const;
export type DavomatHolat = (typeof DAVOMAT_HOLATLARI)[number];

export const DAVOMAT_NOMI: Record<DavomatHolat, string> = {
  keldi: "Keldi",
  yarim: "Yarim kun",
  kelmadi: "Kelmadi",
  tatil: "Ta'til / dam",
};

/** Ikkilangan kun ulushi — kasr sonlardan qochish uchun (pul har doim Int). */
export const DAVOMAT_ULUSH: Record<DavomatHolat, number> = {
  keldi: 2,
  yarim: 1,
  kelmadi: 0,
  tatil: 0,
};

const oySchema = z.string().regex(/^\d{4}-\d{2}$/, "Oy \"YYYY-MM\" ko'rinishida bo'lishi kerak");
const sanaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda");

export const createEmployeeSchema = z.object({
  ism: z.string().trim().min(1, "Xodim ismi kiritilishi shart").max(120),
  lavozim: z.string().trim().max(100).optional().nullable(),
  tel: z.string().trim().max(50).optional().nullable(),
  /** Profil rasmi havolasi (blob yoki tashqi URL) — server `havolaniTekshir` bilan tekshiradi. */
  rasmUrl: z.string().trim().max(1000).optional().nullable(),
  stavka: z.number().int().min(0).max(100_000_000_000).default(0),
  stavkaTuri: z.enum(STAVKA_TURLARI).default("oylik"),
  ishBoshlagan: sanaSchema.optional().nullable(),
  izoh: z.string().trim().max(500).optional().nullable(),
  /** Tizim hisobi bilan bog'lash (ixtiyoriy). */
  userId: z.string().min(1).optional().nullable(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const davomatSchema = z.object({
  employeeId: z.string().min(1),
  sana: sanaSchema,
  holat: z.enum(DAVOMAT_HOLATLARI),
  izoh: z.string().trim().max(200).optional().nullable(),
});

export const avansSchema = z.object({
  employeeId: z.string().min(1),
  oy: oySchema,
  summa: z.number().int().positive("Avans musbat bo'lishi kerak").max(100_000_000_000),
  sana: sanaSchema.optional().nullable(),
  izoh: z.string().trim().max(300).optional().nullable(),
});

export const oylikHisoblaSchema = z.object({
  employeeId: z.string().min(1),
  oy: oySchema,
  qoshimcha: z.number().int().min(0).max(100_000_000_000).optional(),
  ushlab: z.number().int().min(0).max(100_000_000_000).optional(),
  izoh: z.string().trim().max(300).optional().nullable(),
});

export const oylikTolaSchema = z.object({
  sana: sanaSchema.optional().nullable(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type DavomatInput = z.infer<typeof davomatSchema>;
export type AvansInput = z.infer<typeof avansSchema>;
export type OylikHisoblaInput = z.infer<typeof oylikHisoblaSchema>;

// ---------------------------------------------------------------------------
// Xodim oylik plani
// ---------------------------------------------------------------------------

export const PLAN_TURLARI = ["zakaz", "savdo", "kirim", "vazifa"] as const;
export type PlanTuri = (typeof PLAN_TURLARI)[number];

export const PLAN_NOMI: Record<PlanTuri, string> = {
  zakaz: "Zakaz soni",
  savdo: "Savdo summasi",
  kirim: "Kirim summasi",
  vazifa: "Vazifa soni",
};

/** Plan birligi — UI'da maqsad yonida ko'rsatiladi. */
export const PLAN_BIRLIK: Record<PlanTuri, string> = {
  zakaz: "zakaz",
  savdo: "so'm",
  kirim: "so'm",
  vazifa: "vazifa",
};

export const planSchema = z.object({
  employeeId: z.string().min(1),
  oy: oySchema,
  planTuri: z.enum(PLAN_TURLARI),
  maqsad: z.number().int().positive("Plan musbat bo'lishi kerak").max(100_000_000_000),
  izoh: z.string().trim().max(300).optional().nullable(),
});

export type PlanInput = z.infer<typeof planSchema>;

// ---------------------------------------------------------------------------
// Xodim vazifalari (Task.employeeId)
// ---------------------------------------------------------------------------

/** "Kechikdi" ALOHIDA holat emas — muddatdan hisoblab chiqariladi. */
export const VAZIFA_HOLATLARI = ["OCHIQ", "JARAYONDA", "BAJARILDI", "BEKOR"] as const;
export type VazifaHolat = (typeof VAZIFA_HOLATLARI)[number];

export const VAZIFA_HOLAT_NOMI: Record<VazifaHolat, string> = {
  OCHIQ: "Yangi",
  JARAYONDA: "Jarayonda",
  BAJARILDI: "Bajarildi",
  BEKOR: "Bekor qilindi",
};

export const MUHIMLIK_TURLARI = ["past", "orta", "yuqori"] as const;
export type Muhimlik = (typeof MUHIMLIK_TURLARI)[number];

export const MUHIMLIK_NOMI: Record<Muhimlik, string> = {
  past: "Past",
  orta: "O'rta",
  yuqori: "Yuqori",
};

export const vazifaCreateSchema = z.object({
  employeeId: z.string().min(1),
  nomi: z.string().trim().min(1, "Vazifa nomi kiritilishi shart").max(200),
  izoh: z.string().trim().max(1000).optional().nullable(),
  boshlanish: sanaSchema.optional().nullable(),
  muddat: sanaSchema.optional().nullable(),
  muhimlik: z.enum(MUHIMLIK_TURLARI).default("orta"),
});

export const vazifaUpdateSchema = z.object({
  nomi: z.string().trim().min(1).max(200).optional(),
  izoh: z.string().trim().max(1000).optional().nullable(),
  boshlanish: sanaSchema.optional().nullable(),
  muddat: sanaSchema.optional().nullable(),
  muhimlik: z.enum(MUHIMLIK_TURLARI).optional(),
  holat: z.enum(VAZIFA_HOLATLARI).optional(),
});

export type VazifaCreateInput = z.infer<typeof vazifaCreateSchema>;
export type VazifaUpdateInput = z.infer<typeof vazifaUpdateSchema>;
