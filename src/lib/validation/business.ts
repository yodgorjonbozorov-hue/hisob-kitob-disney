import { z } from "zod";

export const createBusinessSchema = z.object({
  nomi: z.string().min(1, "Nomi kiritilishi shart").max(100),
  // "avto" tanlansa ombor tizimi avtomatik yoqiladi (route'da).
  turi: z.enum(["umumiy", "avto", "optom"]).optional(),
  /**
   * Ombor va sotuv shu bizneste yuritiladimi. OMBOR moduli tenant darajasida
   * yoqiladi, bu bayroq esa BIZNES darajasida — bir tenantda tovar sotadigan
   * va sotmaydigan bizneslar yonma-yon bo'lishi mumkin.
   */
  omborli: z.boolean().optional(),
  /**
   * Do'kon kassasi (POS) shu bizneste yuritiladimi. `omborli` bilan bir xil
   * qoida: MAGAZIN moduli tenant darajasida, bu bayroq biznes darajasida.
   */
  magazin: z.boolean().optional(),
  /**
   * Biznes faoliyati (lib/biznesFaoliyati.ts kodi). Berilsa `turi`,
   * `omborli` va `magazin` shundan kelib chiqadi va tegishli modullar
   * yoqiladi — foydalanuvchi texnik bayroqlarni bilishi shart emas.
   */
  faoliyat: z.string().max(20).optional().nullable(),
  /**
   * Shaxsiy kassa rejimi: naqd yozuv uni KIRITGAN xodimning kassasiga tushadi.
   * Yoqilganda biznesning har faol xodimiga kassa ochiladi (route'da).
   */
  shaxsiyKassa: z.boolean().optional(),
  /**
   * Boshlang'ich kassa nomi (setup wizard'ning "Kassa" qadami). Berilmasa
   * standart nom ishlatiladi — har biznesda kamida bitta kassa BO'LISHI
   * SHART, shuning uchun bu maydon kassani ixtiyoriy qilmaydi, faqat nomini
   * so'raydi.
   */
  kassaNomi: z.string().max(60).optional(),
});

export const updateBusinessSchema = z.object({
  nomi: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  turi: z.enum(["umumiy", "avto", "optom"]).optional(),
  omborli: z.boolean().optional(),
  /** Do'kon kassasi (POS) shu bizneste yuritiladimi. */
  magazin: z.boolean().optional(),
  /**
   * Shaxsiy kassa rejimi: naqd yozuv uni KIRITGAN xodimning kassasiga tushadi.
   * Yoqilganda biznesning har faol xodimiga kassa ochiladi (route'da).
   */
  shaxsiyKassa: z.boolean().optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
