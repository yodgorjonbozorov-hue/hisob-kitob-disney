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
  // ESKI MAYDON — bitta biznes. Saqlanadi (mavjud chaqiruvlar buzilmasin):
  // berilsa `businessIds: [businessId]` bilan bir xil ma'noga ega.
  businessId: z.string().optional().nullable(),
  // KO'P-BIZNESLIK: xodim bir nechta biznesga biriktiriladi. Kassir uchun
  // kamida bitta majburiy (server tekshiradi), sotuvchi uchun ixtiyoriy
  // (bo'sh — barcha bizneslar), direktor uchun e'tiborsiz.
  businessIds: z.array(z.string()).max(50).optional().nullable(),
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
  /** Ko'p-bizneslik: to'liq ro'yxat (berilgan bo'lsa eskisi shu bilan ALMASHADI). */
  businessIds: z.array(z.string()).max(50).optional().nullable(),
  // MAXSUS ROL (PRO): null — maxsus roldan chiqarish (tizim roliga qaytadi).
  roleId: z.string().optional().nullable(),
  huquqPlus: z.array(huquqKodi).max(50).optional().nullable(),
  huquqMinus: z.array(huquqKodi).max(50).optional().nullable(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
