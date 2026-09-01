import { z } from "zod";

/**
 * KPI moduli validatsiyasi — barcha yozish amallari shu yerdan o'tadi.
 *
 * PUL VA BALL BUTUN SONDA: `z.number().int()` kasr qiymatni rad etadi, ya'ni
 * float hech qachon bazaga tushmaydi (CLAUDE.md invarianti).
 *
 * FOIZ yuzdan bir aniqlikda: 2% → 200, 110% → 11000.
 */

const oySchema = z.string().regex(/^\d{4}-\d{2}$/, "Oy \"YYYY-MM\" ko'rinishida bo'lishi kerak");
const sanaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda");

/** Pul chegarasi — 1 trln so'm; xato kiritilgan nolni erta ushlaydi. */
const pul = z.number().int().min(0).max(1_000_000_000_000);

export const vazifaYaratSchema = z.object({
  nomi: z.string().trim().min(1, "Vazifa nomi kiritilishi shart").max(200),
  izoh: z.string().trim().max(1000).optional().nullable(),
  oylikHaq: pul.default(0),
  tartib: z.number().int().min(0).max(9999).optional(),
});

export const vazifaYangilaSchema = z.object({
  nomi: z.string().trim().min(1).max(200).optional(),
  izoh: z.string().trim().max(1000).optional().nullable(),
  oylikHaq: pul.optional(),
  aktiv: z.boolean().optional(),
  tartib: z.number().int().min(0).max(9999).optional(),
});

export const biriktiruvSchema = z.object({
  employeeId: z.string().min(1, "Xodim tanlanmagan"),
  aktiv: z.boolean(),
});

export const presetYaratSchema = z.object({
  taskId: z.string().min(1).optional().nullable(),
  sabab: z.string().trim().min(1, "Sabab yozilishi shart").max(300),
  /** Ayiriladigan ball — musbat son sifatida saqlanadi (UI "-4" ko'rsatadi). */
  ball: z.number().int().min(1, "Ball 1 dan kam bo'lmasligi kerak").max(100),
  kritik: z.boolean().optional(),
  tartib: z.number().int().min(0).max(9999).optional(),
});

export const ballAyirSchema = z.object({
  employeeId: z.string().min(1, "Xodim tanlanmagan"),
  taskId: z.string().min(1, "Vazifa tanlanmagan"),
  sana: sanaSchema,
  ball: z.number().int().min(1, "Ball 1 dan kam bo'lmasligi kerak").max(100),
  sabab: z.string().trim().min(1, "Sabab yozilishi shart").max(300),
  izoh: z.string().trim().max(1000).optional().nullable(),
  /**
   * Kritik (ishonch) holatimi. MIJOZDAN kelgan qiymatga ishonilmaydi:
   * preset berilgan bo'lsa server presetdagi qiymatni oladi
   * (lib/kpi/ball.ts chaqiruvchisi shuni ta'minlaydi).
   */
  kritik: z.boolean().optional(),
  presetId: z.string().min(1).optional().nullable(),
});

export const ballQaytarSchema = z.object({
  izoh: z.string().trim().max(1000).optional().nullable(),
});

export const sotuvPlaniSchema = z.object({
  employeeId: z.string().min(1, "Xodim tanlanmagan"),
  oy: oySchema,
  /** null — alohida plan olib tashlanadi, standart plan qaytadi. */
  maqsad: pul.nullable(),
  planBonus: pul.optional().nullable(),
  izoh: z.string().trim().max(500).optional().nullable(),
});

export const oyniYopSchema = z.object({
  employeeId: z.string().min(1, "Xodim tanlanmagan"),
  oy: oySchema,
  izoh: z.string().trim().max(1000).optional().nullable(),
});

export const tolovSchema = z.object({
  summa: pul.optional().nullable(),
});

export const tuzatishSchema = z.object({
  /** Musbat — qo'shimcha, manfiy — ushlab qolish. Nol qabul qilinmaydi. */
  summa: z
    .number()
    .int()
    .min(-1_000_000_000_000)
    .max(1_000_000_000_000)
    .refine((n) => n !== 0, "Tuzatish summasi nolga teng bo'lmasligi kerak"),
  sabab: z.string().trim().min(1, "Tuzatish sababi yozilishi shart").max(300),
});

/** Progressiv bonus intervali. `gacha` null — yuqori chegara yo'q. */
const intervalSchema = z.object({
  dan: pul,
  gacha: pul.nullable(),
  /** Yuzdan bir aniqlikda: 2% → 200. 100% (10000) dan oshmaydi. */
  foiz: z.number().int().min(0).max(10_000),
});

/** Ball → foiz qatori. Foiz 110% (11000) gacha — rag'bat uchun. */
const ballQoidaSchema = z.object({
  minBall: z.number().int().min(0).max(1000),
  maxBall: z.number().int().min(0).max(1000),
  foiz: z.number().int().min(0).max(50_000),
});

export const sozlamaSchema = z
  .object({
    mavsumOylar: z.array(z.number().int().min(1).max(12)).max(12),
    mavsumPlan: pul,
    mavsumsizPlan: pul,
    planBonus: pul,
    boshlangichBall: z.number().int().min(1).max(1000),
    kunlikLimit: z.number().int().min(0).max(1000),
    intervallar: z.array(intervalSchema).min(1, "Kamida bitta interval bo'lishi kerak").max(20),
    ballQoidalari: z.array(ballQoidaSchema).min(1, "Kamida bitta ball qoidasi bo'lishi kerak").max(20),
  })
  .refine(
    (s) => s.intervallar.every((i) => i.gacha === null || i.gacha > i.dan),
    "Interval yuqori chegarasi quyi chegaradan katta bo'lishi kerak"
  )
  .refine(
    (s) => s.ballQoidalari.every((q) => q.maxBall >= q.minBall),
    "Ball qoidasida yuqori chegara quyi chegaradan kichik bo'lmasligi kerak"
  );

export type SozlamaInput = z.infer<typeof sozlamaSchema>;
