import { z } from "zod";

export const createCategorySchema = z.object({
  nomi: z.string().min(1, "Nomi kiritilishi shart").max(100),
  turi: z.enum(["kirim", "chiqim"]),
  tartib: z.number().int().optional(),
});

export const updateCategorySchema = z.object({
  nomi: z.string().min(1).max(100).optional(),
  tartib: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
