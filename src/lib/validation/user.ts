import { z } from "zod";

export const createUserSchema = z.object({
  ism: z.string().min(1, "Ism kiritilishi shart").max(100),
  login: z.string().min(3, "Login kamida 3 belgi bo'lishi kerak").max(50),
  parol: z.string().min(4, "Parol kamida 4 belgi bo'lishi kerak").max(100),
  rol: z.enum(["admin", "kassir"]).default("kassir"),
});

export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  parol: z.string().min(4).max(100).optional(),
  ism: z.string().min(1).max(100).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
