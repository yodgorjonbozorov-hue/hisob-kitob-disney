import { z } from "zod";

export const createBusinessSchema = z.object({
  nomi: z.string().min(1, "Nomi kiritilishi shart").max(100),
  // "avto" tanlansa ombor tizimi avtomatik yoqiladi (route'da).
  turi: z.enum(["umumiy", "avto"]).optional(),
});

export const updateBusinessSchema = z.object({
  nomi: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  turi: z.enum(["umumiy", "avto"]).optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
