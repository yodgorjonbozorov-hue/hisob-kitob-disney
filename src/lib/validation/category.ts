import { z } from "zod";

/**
 * Nom uzunligi chegarasi. 60 belgi — eng uzun haqiqiy kategoriya nomi ham
 * ("Rasmiylashtirish (MRB, notarius)" — 32) bemalol sig'adi, lekin ro'yxat
 * va jadval qatorini buzadigan "matn devori" o'tmaydi.
 */
const NOM_MAX = 60;

/**
 * Nom maydoni: bo'sh yoki faqat bo'shliqdan iborat bo'lolmaydi.
 *
 * `trim()` VALIDATSIYADAN OLDIN qo'llanadi — aks holda " " (bitta probel)
 * `min(1)` dan o'tib ketardi va bazaga ko'rinmas nomli kategoriya tushardi.
 */
const nomMaydoni = z
  .string()
  .trim()
  .min(1, "Kategoriya nomi bo'sh bo'lmasligi kerak")
  .max(NOM_MAX, `Kategoriya nomi ${NOM_MAX} belgidan oshmasin`);

/**
 * `kgAsosli` — kg savdosi bayrog'i (mijozga xos, lib/mijozXos.ts). Faqat
 * kirim kategoriyasida ma'noga ega: bunda summa qo'lda kiritilmaydi, miqdor
 * (kg) × 1 kg narxi so'raladi. Bayroq boshqa mijozlarda hech qachon
 * yoqilmaydi — UI ham, hisobot bloki ham ularga ko'rinmaydi.
 */
export const createCategorySchema = z
  .object({
    nomi: nomMaydoni,
    turi: z.enum(["kirim", "chiqim"]),
    tartib: z.number().int().optional(),
    kgAsosli: z.boolean().optional(),
  })
  .refine((d) => !d.kgAsosli || d.turi === "kirim", {
    message: "Kg savdosi faqat kirim kategoriyasida bo'ladi",
  });

/**
 * `turi` YANGILASHDA HAM BOR, lekin servis uni faqat kategoriya hech qayerda
 * ishlatilmagan bo'lsagina qabul qiladi (lib/services/kategoriya.ts) —
 * ishlatilgan kategoriyaning yo'nalishini almashtirish tarixiy hisobotni
 * o'zining yozuvlariga qarama-qarshi qilib qo'yardi.
 */
export const updateCategorySchema = z
  .object({
    nomi: nomMaydoni.optional(),
    turi: z.enum(["kirim", "chiqim"]).optional(),
    tartib: z.number().int().optional(),
    isActive: z.boolean().optional(),
    kgAsosli: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "O'zgartirish uchun maydon berilmadi" });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
