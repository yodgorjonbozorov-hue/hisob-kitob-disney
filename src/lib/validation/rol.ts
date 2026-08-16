import { z } from "zod";
import { HUQUQ_KODLARI } from "@/lib/permissions/katalog";

/** Maxsus rol nav skeleti — foydalanuvchi qaysi tizim roli kabi sahifa ko'radi. */
export const BAZA_ROLLAR = ["ADMIN", "CASHIER", "SELLER"] as const;

const huquqKodi = z
  .string()
  .refine((k) => HUQUQ_KODLARI.has(k), { message: "Noma'lum huquq kodi" });

export const createRoleSchema = z.object({
  nomi: z.string().trim().min(2, "Rol nomi kamida 2 belgi").max(50),
  izoh: z.string().trim().max(300).optional().nullable(),
  huquqlar: z.array(huquqKodi).max(50).default([]),
  bazaRol: z.enum(BAZA_ROLLAR).default("SELLER"),
});

export const updateRoleSchema = z.object({
  nomi: z.string().trim().min(2).max(50).optional(),
  izoh: z.string().trim().max(300).optional().nullable(),
  huquqlar: z.array(huquqKodi).max(50).optional(),
  bazaRol: z.enum(BAZA_ROLLAR).optional(),
  isActive: z.boolean().optional(),
});

/** Foydalanuvchiga alohida huquq override'lari. */
export const huquqOverrideSchema = z.object({
  huquqPlus: z.array(huquqKodi).max(50).optional(),
  huquqMinus: z.array(huquqKodi).max(50).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
