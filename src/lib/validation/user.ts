import { z } from "zod";

export const createUserSchema = z.object({
  ism: z.string().min(1, "Ism kiritilishi shart").max(100),
  login: z.string().min(3, "Login kamida 3 belgi bo'lishi kerak").max(50),
  parol: z.string().min(8, "Parol kamida 8 belgi bo'lishi kerak").max(100),
  // SUPERADMIN bu yerda yo'q — panel orqali yaratilmaydi. ADMIN roli FAZA 2+ da ochiladi.
  rol: z.enum(["OWNER", "CASHIER", "SELLER"]).default("CASHIER"),
  // Kassir uchun biznes id majburiy (server tekshiradi); owner/seller uchun bo'sh/null (tenant ichidagi barcha bizneslar).
  businessId: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  parol: z.string().min(8, "Parol kamida 8 belgi bo'lishi kerak").max(100).optional(),
  ism: z.string().min(1).max(100).optional(),
  rol: z.enum(["OWNER", "CASHIER", "SELLER"]).optional(),
  businessId: z.string().optional().nullable(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
