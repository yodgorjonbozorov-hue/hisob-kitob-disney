import { z } from "zod";

/**
 * MIJOZ TELEGRAM XABARNOMASI — kirish validatsiyasi.
 *
 * Buyurtma manbai IKKITA bo'lishi mumkin (chek yoki yakka sotuv), lekin
 * bir vaqtda FAQAT BITTASI: aks holda qaysi buyurtma yuborilayotgani
 * noaniq bo'lardi va xizmat qatlami jimgina birinchisini tanlab qo'yardi.
 */
export const qaytaYuborishSchema = z
  .object({
    chekId: z.string().min(1).optional().nullable(),
    saleId: z.string().min(1).optional().nullable(),
  })
  .refine((d) => Boolean(d.chekId) !== Boolean(d.saleId), {
    message: "Buyurtma sifatida chekId yoki saleId dan ANIQ BITTASI berilishi kerak",
  });

export type QaytaYuborishInput = z.infer<typeof qaytaYuborishSchema>;
