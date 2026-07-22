import { z } from "zod";

export const createBusinessSchema = z.object({
  nomi: z.string().min(1, "Nomi kiritilishi shart").max(100),
});

export const updateBusinessSchema = z.object({
  nomi: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
