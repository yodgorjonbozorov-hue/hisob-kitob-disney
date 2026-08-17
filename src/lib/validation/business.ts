import { z } from "zod";

export const createBusinessSchema = z.object({
  nomi: z.string().min(1, "Nomi kiritilishi shart").max(100),
  // "avto" tanlansa ombor tizimi avtomatik yoqiladi (route'da).
  turi: z.enum(["umumiy", "avto"]).optional(),
  /**
   * Ombor va sotuv shu bizneste yuritiladimi. OMBOR moduli tenant darajasida
   * yoqiladi, bu bayroq esa BIZNES darajasida — bir tenantda tovar sotadigan
   * va sotmaydigan bizneslar yonma-yon bo'lishi mumkin.
   */
  omborli: z.boolean().optional(),
});

export const updateBusinessSchema = z.object({
  nomi: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  turi: z.enum(["umumiy", "avto"]).optional(),
  omborli: z.boolean().optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
