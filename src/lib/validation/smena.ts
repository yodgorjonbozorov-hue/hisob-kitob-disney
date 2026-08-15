import { z } from "zod";

/**
 * SMENA YAKUNI — zod sxemalari.
 *
 * Pul har doim butun son (so'm). Sanalgan naqd 0 ham bo'lishi mumkin
 * (naqd tushumsiz smena), lekin manfiy hech qachon.
 */

const summaSchema = z
  .number({ invalid_type_error: "Summa raqam bo'lishi kerak" })
  .int("Summa butun son bo'lishi kerak (so'm)")
  .min(0, "Summa manfiy bo'lmaydi")
  .max(100_000_000_000, "Summa juda katta");

/**
 * SMENANI YOPISH: xodim kassadagi naqdni SANAB kiritadi.
 *
 * `qoldirilganNaqd` — sanalgan puldan kassada ataylab qoldirilgani (ertangi
 * qaytim uchun). Odatda 0: pul to'liq topshiriladi va kassa 0 dan boshlanadi.
 */
export const smenaYopishSchema = z
  .object({
    sanalganNaqd: summaSchema,
    qoldirilganNaqd: summaSchema.optional(),
    izoh: z.string().trim().max(300, "Izoh 300 belgidan oshmasin").optional(),
  })
  .refine((d) => (d.qoldirilganNaqd ?? 0) <= d.sanalganNaqd, {
    message: "Kassada qoldirilgan pul sanalgan puldan ko'p bo'lmaydi",
    path: ["qoldirilganNaqd"],
  });
export type SmenaYopishInput = z.infer<typeof smenaYopishSchema>;

/** Smenani qayta ochish (xato yopilgan bo'lsa) — faqat oxirgi smena. */
export const smenaQaytaOchishSchema = z.object({
  smenaId: z.string().min(1, "Smena tanlanmagan"),
});
export type SmenaQaytaOchishInput = z.infer<typeof smenaQaytaOchishSchema>;
