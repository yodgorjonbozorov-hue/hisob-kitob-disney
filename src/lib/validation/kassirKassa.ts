import { z } from "zod";

/**
 * KASSIR KASSASI — zod sxemalari.
 *
 * Pul har doim butun son (so'm), hech qachon float.
 *
 * DIQQAT: topshiriladigan summa uchun `hisoblangan` (tizim hisobi) sxemada
 * YO'Q — u serverda qayta hisoblanadi. Aks holda kassir so'rov tanasida
 * "menda 100 000 bor edi" deb yozib, aldab yuborardi (talab 11).
 */

const summaSchema = z
  .number({ invalid_type_error: "Summa raqam bo'lishi kerak" })
  .int("Summa butun son bo'lishi kerak (so'm)")
  .min(0, "Summa manfiy bo'lmaydi")
  .max(100_000_000_000, "Summa juda katta");

const izohSchema = z.string().trim().max(300, "Izoh 300 belgidan oshmasin").optional();

/**
 * KASSANI TOPSHIRISH.
 *
 * `topshirilgan` — kassir HAQIQATDA sanab bergan naqd. Default qiymat UI'da
 * tizim hisoblagan qoldiq bo'ladi; kassir uni faqat kam (kamomad) yoki ko'p
 * (ortiqcha) qilib o'zgartira oladi va farq direktorga ko'rinadi.
 */
export const topshirishSchema = z.object({
  topshirilgan: summaSchema,
  izoh: izohSchema,
});
export type TopshirishInput = z.infer<typeof topshirishSchema>;

/**
 * DIREKTOR QARORI.
 *
 * `farqYopildi` — kamomad (yoki ortiqcha) kassir hisobidan chiqarilsinmi.
 * false bo'lsa kamomad kassirning kassasida OCHIQ qoladi: u hali ham
 * o'sha pulga javobgar. Ortiqchada server buni majburan true qiladi —
 * manfiy kassa qoldig'ining ma'nosi yo'q.
 */
export const qabulSchema = z.object({
  amal: z.literal("qabul"),
  farqYopildi: z.boolean().optional(),
  qarorIzoh: izohSchema,
});

export const radSchema = z.object({
  amal: z.literal("rad"),
  qarorIzoh: izohSchema,
});

export const bekorSchema = z.object({
  amal: z.literal("bekor"),
});

export const qarorSchema = z.discriminatedUnion("amal", [qabulSchema, radSchema, bekorSchema]);
export type QarorInput = z.infer<typeof qarorSchema>;

/** KASSAGA PUL BERISH — direktor kassirga boshlang'ich/qaytim puli beradi. */
export const pulBerishSchema = z.object({
  kassirId: z.string().min(1, "Kassir tanlanmagan"),
  summa: summaSchema.refine((v) => v > 0, "Summa 0 dan katta bo'lishi kerak"),
  izoh: izohSchema,
});
export type PulBerishInput = z.infer<typeof pulBerishSchema>;

/** Holat kodi -> UI yorlig'i. */
export const HOLAT_NOMI: Record<string, string> = {
  kutilmoqda: "Kutilmoqda",
  qabul: "Qabul qilindi",
  rad: "Rad etildi",
  bekor: "Bekor qilindi",
};

/** Harakat turi -> UI yorlig'i. */
export const TURI_NOMI: Record<string, string> = {
  topshirish: "Kassa topshirig'i",
  berish: "Kassaga pul berildi",
};
