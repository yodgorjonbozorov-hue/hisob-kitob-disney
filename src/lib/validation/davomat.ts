import { z } from "zod";

// ---------------------------------------------------------------------------
// DAVOMAT 2.0 — konstantalar
// ---------------------------------------------------------------------------

/** Tekshiruv turlari: kelish (check-in) va ketish (check-out). */
export const TEKSHIRUV_TURLARI = ["kelish", "ketish"] as const;
export type TekshiruvTuri = (typeof TEKSHIRUV_TURLARI)[number];

/** Davomat manbalari. "kamera" — Faza 2 (CCTV/yuz tanish) uchun zaxira qiymat. */
export const DAVOMAT_MANBALARI = ["selfie_gps", "admin", "kamera"] as const;
export type DavomatManba = (typeof DAVOMAT_MANBALARI)[number];

/** Jarima holatlari — oylikka FAQAT "tasdiqlandi" kiradi. */
export const JARIMA_HOLATLARI = ["kutilmoqda", "tasdiqlandi", "rad"] as const;
export type JarimaHolat = (typeof JARIMA_HOLATLARI)[number];

export const JARIMA_HOLAT_NOMI: Record<JarimaHolat, string> = {
  kutilmoqda: "Kutilmoqda",
  tasdiqlandi: "Tasdiqlangan",
  rad: "Rad etilgan",
};

/** Jarima qoidasi turlari. */
export const QOIDA_TURLARI = ["kechikish", "kelmadi"] as const;
export type QoidaTuri = (typeof QOIDA_TURLARI)[number];

export const QOIDA_TURI_NOMI: Record<QoidaTuri, string> = {
  kechikish: "Kechikish",
  kelmadi: "Kelmagan kun",
};

/** Hafta kunlari nomlari — indeks JS `getUTCDay()` bilan mos (0=Yakshanba). */
export const HAFTA_KUNLARI = [
  "Yakshanba",
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
] as const;

/** Selfie: faqat rasm, qattiq hajm chegarasi (mijoz siqib yuboradi). */
export const SELFIE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const SELFIE_MAX_BAYT = 400 * 1024;

/** GPS aniqligi shu chegaradan yomon bo'lsa qabul qilinmaydi (metr). */
export const GPS_MAX_ANIQLIK_M = 300;

/** Radius uchun tayyor variantlar (UI preset). */
export const RADIUS_PRESETLAR = [50, 100, 200, 500] as const;

const sanaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda");
const soatSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Vaqt \"HH:MM\" ko'rinishida bo'lishi kerak");

// ---------------------------------------------------------------------------
// Ish joyi
// ---------------------------------------------------------------------------

export const createWorkLocationSchema = z.object({
  nomi: z.string().trim().min(1, "Ish joyi nomi kiritilishi shart").max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(20, "Radius kamida 20 m").max(10_000, "Radius 10 km dan oshmasin"),
  standart: z.boolean().optional(),
});

export const updateWorkLocationSchema = createWorkLocationSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Ish jadvali
// ---------------------------------------------------------------------------

const jadvalKuniSchema = z
  .object({
    hafta: z.number().int().min(0).max(6),
    ishKuni: z.boolean(),
    boshlanish: soatSchema.optional().nullable(),
    tugash: soatSchema.optional().nullable(),
  })
  .refine((k) => !k.ishKuni || (k.boshlanish && k.tugash), {
    message: "Ish kuni uchun boshlanish va tugash vaqti kiritilishi shart",
  });

export const createWorkScheduleSchema = z.object({
  nomi: z.string().trim().min(1, "Jadval nomi kiritilishi shart").max(120),
  imtiyozDaqiqa: z.number().int().min(0).max(120).default(5),
  standart: z.boolean().optional(),
  kuchgaKirgan: sanaSchema.optional().nullable(),
  kunlar: z.array(jadvalKuniSchema).length(7, "Haftaning 7 kuni ham berilishi kerak"),
});

export const updateWorkScheduleSchema = z.object({
  nomi: z.string().trim().min(1).max(120).optional(),
  imtiyozDaqiqa: z.number().int().min(0).max(120).optional(),
  standart: z.boolean().optional(),
  kuchgaKirgan: sanaSchema.optional().nullable(),
  isActive: z.boolean().optional(),
  kunlar: z.array(jadvalKuniSchema).length(7).optional(),
});

// ---------------------------------------------------------------------------
// Check-in / check-out (xodimning o'zi)
// ---------------------------------------------------------------------------

/**
 * Mijozdan FAQAT joylashuv va selfie qabul qilinadi. Vaqt maydoni ATAYLAB
 * yo'q — server soati yagona haqiqat manbai (mijoz yuborsa ham o'qilmaydi).
 */
export const checkSchema = z.object({
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  /** GPS aniqligi (metr) — qurilma bergan accuracy. */
  aniqlikM: z.number().min(0).max(100_000).optional().nullable(),
  /** Selfie: data-URI'siz sof base64. */
  selfieBase64: z.string().max(Math.ceil((SELFIE_MAX_BAYT * 4) / 3) + 16).optional().nullable(),
  selfieMime: z.enum(SELFIE_MIME).optional().nullable(),
});

export type CheckInput = z.infer<typeof checkSchema>;

// ---------------------------------------------------------------------------
// Admin tuzatishi
// ---------------------------------------------------------------------------

export const tuzatishSchema = z.object({
  employeeId: z.string().min(1),
  sana: sanaSchema,
  /** "HH:MM" (Toshkent) yoki null — tegilmaydi. */
  kelganVaqt: soatSchema.optional().nullable(),
  ketganVaqt: soatSchema.optional().nullable(),
  /** Kelmagan/ta'til deb belgilash uchun holat (ixtiyoriy). */
  holat: z.enum(["keldi", "yarim", "kelmadi", "tatil"]).optional(),
  sabab: z.string().trim().min(3, "Tuzatish sababi kiritilishi shart").max(300),
});

export type TuzatishInput = z.infer<typeof tuzatishSchema>;

// ---------------------------------------------------------------------------
// Jarima qoidalari
// ---------------------------------------------------------------------------

export const createPenaltyRuleSchema = z
  .object({
    turi: z.enum(QOIDA_TURLARI).default("kechikish"),
    minDaqiqa: z.number().int().min(0).max(1440).default(0),
    maxDaqiqa: z.number().int().min(0).max(1440).optional().nullable(),
    summa: z.number().int().min(0).max(100_000_000),
    isActive: z.boolean().optional(),
  })
  .refine((q) => q.turi !== "kechikish" || q.maxDaqiqa == null || q.maxDaqiqa >= q.minDaqiqa, {
    message: "Yuqori chegara quyi chegaradan kichik bo'lmasligi kerak",
  });

export const updatePenaltyRuleSchema = z.object({
  minDaqiqa: z.number().int().min(0).max(1440).optional(),
  maxDaqiqa: z.number().int().min(0).max(1440).optional().nullable(),
  summa: z.number().int().min(0).max(100_000_000).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Jarima (qo'lda) va qaror
// ---------------------------------------------------------------------------

export const createPenaltySchema = z.object({
  employeeId: z.string().min(1),
  sana: sanaSchema,
  summa: z.number().int().positive("Jarima musbat bo'lishi kerak").max(100_000_000),
  sabab: z.string().trim().min(1, "Sabab kiritilishi shart").max(300),
  izoh: z.string().trim().max(300).optional().nullable(),
});

export const penaltyQarorSchema = z.object({
  amal: z.enum(["tasdiqlash", "rad"]),
  /** Tasdiqda summani tahrirlash mumkin — asl summa auditda qoladi. */
  summa: z.number().int().min(0).max(100_000_000).optional(),
  izoh: z.string().trim().max(300).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Bonus
// ---------------------------------------------------------------------------

export const createBonusSchema = z.object({
  employeeId: z.string().min(1),
  sana: sanaSchema,
  summa: z.number().int().positive("Bonus musbat bo'lishi kerak").max(100_000_000_000),
  sabab: z.string().trim().min(1, "Sabab kiritilishi shart").max(300),
  izoh: z.string().trim().max(300).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Xodim davomat siyosati (Employee'ga qo'shimcha maydonlar)
// ---------------------------------------------------------------------------

export const xodimSiyosatSchema = z.object({
  workScheduleId: z.string().min(1).optional().nullable(),
  workLocationId: z.string().min(1).optional().nullable(),
  selfieTalab: z.boolean().optional(),
  gpsTalab: z.boolean().optional(),
  radiusTalab: z.boolean().optional(),
});

export type XodimSiyosatInput = z.infer<typeof xodimSiyosatSchema>;

// ---------------------------------------------------------------------------
// HR sozlamalari
// ---------------------------------------------------------------------------

export const hrSettingSchema = z.object({
  xodimOylikKoradi: z.boolean().optional(),
  /** CRM: yangi zakazda sotuvchi majburiymi (6-talab, biznesga sozlanadi). */
  crmSotuvchiMajburiy: z.boolean().optional(),
});

export type CreateWorkLocationInput = z.infer<typeof createWorkLocationSchema>;
export type UpdateWorkLocationInput = z.infer<typeof updateWorkLocationSchema>;
export type CreateWorkScheduleInput = z.infer<typeof createWorkScheduleSchema>;
export type UpdateWorkScheduleInput = z.infer<typeof updateWorkScheduleSchema>;
export type JadvalKuniInput = z.infer<typeof jadvalKuniSchema>;
export type CreatePenaltyRuleInput = z.infer<typeof createPenaltyRuleSchema>;
export type UpdatePenaltyRuleInput = z.infer<typeof updatePenaltyRuleSchema>;
export type CreatePenaltyInput = z.infer<typeof createPenaltySchema>;
export type PenaltyQarorInput = z.infer<typeof penaltyQarorSchema>;
export type CreateBonusInput = z.infer<typeof createBonusSchema>;
export type HrSettingInput = z.infer<typeof hrSettingSchema>;
