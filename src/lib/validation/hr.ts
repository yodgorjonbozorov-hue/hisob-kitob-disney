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
  stavka: z.number().int().min(0).max(2_000_000_000).default(0),
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
  summa: z.number().int().positive("Avans musbat bo'lishi kerak").max(2_000_000_000),
  sana: sanaSchema.optional().nullable(),
  izoh: z.string().trim().max(300).optional().nullable(),
});

export const oylikHisoblaSchema = z.object({
  employeeId: z.string().min(1),
  oy: oySchema,
  qoshimcha: z.number().int().min(0).max(2_000_000_000).optional(),
  ushlab: z.number().int().min(0).max(2_000_000_000).optional(),
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
