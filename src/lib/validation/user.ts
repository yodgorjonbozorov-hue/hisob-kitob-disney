import { z } from "zod";
import { HUQUQ_KODLARI } from "@/lib/permissions/katalog";

const huquqKodi = z
  .string()
  .refine((k) => HUQUQ_KODLARI.has(k), { message: "Noma'lum huquq kodi" });

export const createUserSchema = z.object({
  ism: z.string().min(1, "Ism kiritilishi shart").max(100),
  login: z.string().min(3, "Login kamida 3 belgi bo'lishi kerak").max(50),
  parol: z.string().min(8, "Parol kamida 8 belgi bo'lishi kerak").max(100),
  // SUPERADMIN bu yerda yo'q — panel orqali yaratilmaydi. ADMIN roli FAZA 2+ da ochiladi.
  rol: z.enum(["OWNER", "CASHIER", "SELLER"]).default("CASHIER"),
  // Kassir uchun biznes id majburiy (server tekshiradi); owner/seller uchun bo'sh/null (tenant ichidagi barcha bizneslar).
  businessId: z.string().optional().nullable(),
  // MAXSUS ROL (PRO): berilsa `rol` e'tiborsiz — rol.bazaRol ishlatiladi.
  roleId: z.string().optional().nullable(),
  // Alohida huquq override'lari (PRO).
  huquqPlus: z.array(huquqKodi).max(50).optional(),
  huquqMinus: z.array(huquqKodi).max(50).optional(),
});

export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  parol: z.string().min(8, "Parol kamida 8 belgi bo'lishi kerak").max(100).optional(),
  login: z.string().min(3, "Login kamida 3 belgi bo'lishi kerak").max(50).optional(),
  ism: z.string().min(1).max(100).optional(),
  rol: z.enum(["OWNER", "CASHIER", "SELLER"]).optional(),
  businessId: z.string().optional().nullable(),
  // MAXSUS ROL (PRO): null — maxsus roldan chiqarish (tizim roliga qaytadi).
  roleId: z.string().optional().nullable(),
  huquqPlus: z.array(huquqKodi).max(50).optional().nullable(),
  huquqMinus: z.array(huquqKodi).max(50).optional().nullable(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
