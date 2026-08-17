import { z } from "zod";

/**
 * `kgAsosli` — kg savdosi bayrog'i (mijozga xos, lib/mijozXos.ts). Faqat
 * kirim kategoriyasida ma'noga ega: bunda summa qo'lda kiritilmaydi, miqdor
 * (kg) × 1 kg narxi so'raladi. Bayroq boshqa mijozlarda hech qachon
 * yoqilmaydi — UI ham, hisobot bloki ham ularga ko'rinmaydi.
 */
export const createCategorySchema = z
  .object({
    nomi: z.string().min(1, "Nomi kiritilishi shart").max(100),
    turi: z.enum(["kirim", "chiqim"]),
    tartib: z.number().int().optional(),
    kgAsosli: z.boolean().optional(),
  })
  .refine((d) => !d.kgAsosli || d.turi === "kirim", {
    message: "Kg savdosi faqat kirim kategoriyasida bo'ladi",
  });

export const updateCategorySchema = z.object({
  nomi: z.string().min(1).max(100).optional(),
  tartib: z.number().int().optional(),
  isActive: z.boolean().optional(),
  kgAsosli: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
