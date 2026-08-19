import { z } from "zod";
import { SUPER_ROLLAR } from "@/lib/superadmin/rbac";

/**
 * SUPERADMIN YOZISH AMALLARI UCHUN ZOD SXEMALARI.
 *
 * Loyiha qoidasi: har yozish amali zod bilan validatsiya qilinadi
 * (`lib/validation/`). Xavfli amallarda `sabab` MAJBURIY — server sababsiz
 * so'rovni rad etadi, ya'ni "tasdiqni chetlab o'tish" frontend orqali
 * imkonsiz (talab 46).
 */

/** Xavfli amal sababi: bo'sh bo'lmasligi va mazmunli bo'lishi kerak. */
export const sababSchema = z
  .string()
  .trim()
  .min(10, "Sabab kamida 10 belgi bo'lishi kerak — jurnalda tushunarli qolishi uchun")
  .max(500, "Sabab 500 belgidan oshmasligi kerak");

export const blockSchema = z.object({
  blocked: z.boolean(),
  sabab: sababSchema,
});

export const extendSchema = z.object({
  kunlar: z.number().int().min(1, "Kamida 1 kun").max(366, "Ko'pi bilan 366 kun"),
  sabab: z.string().trim().max(500).optional().nullable(),
});

export const planSchema = z.object({
  plan: z.string().trim().min(1),
  sabab: sababSchema,
});

export const bepulSchema = z.object({
  bepul: z.boolean(),
  sabab: sababSchema,
});

export const yangiMijozSchema = z.object({
  nom: z.string().trim().min(2, "Kompaniya nomi kamida 2 belgi").max(100),
  login: z.string().trim().min(3, "Login kamida 3 belgi").max(50),
  parol: z.string().min(8, "Parol kamida 8 belgi bo'lishi kerak").max(100),
  ism: z.string().trim().max(100).optional().nullable(),
  tarif: z.string().min(1),
  turi: z.enum(["umumiy", "avto"]),
  kunlar: z.number().int().min(0).max(366),
});

export const modulSchema = z.object({
  code: z.string().trim().min(1),
  isActive: z.boolean(),
  /** O'chirishda sabab majburiy (ma'lumot yo'qolmaydi, lekin kirish yopiladi). */
  sabab: z.string().trim().max(500).optional().nullable(),
});

export const userHolatSchema = z.object({
  isActive: z.boolean(),
  sabab: sababSchema,
});

export const parolTiklashSchema = z.object({
  sabab: sababSchema,
});

export const sessiyaBekorSchema = z.object({
  sabab: sababSchema,
});

export const superadminRolSchema = z.object({
  superadminRol: z.enum(SUPER_ROLLAR as [string, ...string[]]),
  sabab: sababSchema,
});

export const impersonateSchema = z.object({
  sabab: sababSchema,
});

export const tolovQarorSchema = z.object({
  sabab: z.string().trim().max(500).optional().nullable(),
});

export const tolovRadSchema = z.object({
  sabab: sababSchema,
});

export const bayroqSchema = z.object({
  kalit: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[A-Z0-9_]+$/, "Kalit faqat KATTA harf, raqam va pastki chiziqdan iborat bo'lsin"),
  nomi: z.string().trim().min(2).max(100),
  tavsif: z.string().trim().max(500).optional().nullable(),
  doira: z.enum(["GLOBAL", "TENANT"]),
  yoqilgan: z.boolean(),
  tenantIdlar: z.array(z.string().trim().min(1)).max(500).default([]),
  sabab: sababSchema,
});

export const bayroqYangilashSchema = bayroqSchema.partial({ kalit: true, nomi: true });

export const tiketSchema = z.object({
  tenantId: z.string().trim().min(1),
  mavzu: z.string().trim().min(3, "Mavzu kamida 3 belgi").max(200),
  tavsif: z.string().trim().min(3, "Tavsif kamida 3 belgi").max(5000),
  muhimlik: z.enum(["PAST", "ORTA", "YUQORI", "KRITIK"]).default("ORTA"),
});

export const tiketYangilashSchema = z.object({
  holat: z.enum(["OCHIQ", "KUTILMOQDA", "YECHILDI", "YOPILDI"]).optional(),
  muhimlik: z.enum(["PAST", "ORTA", "YUQORI", "KRITIK"]).optional(),
  masulId: z.string().trim().min(1).nullable().optional(),
  xabar: z.string().trim().min(1).max(5000).optional(),
  ichki: z.boolean().optional(),
});

/** Ommaviy (bulk) amal — ID ro'yxati va sabab. */
export const ommaviySchema = z.object({
  idlar: z.array(z.string().trim().min(1)).min(1, "Kamida bitta yozuv tanlansin").max(200),
  amal: z.enum(["block", "unblock"]),
  sabab: sababSchema,
});

export const eksportSchema = z.object({
  turi: z.enum(["bizneslar", "foydalanuvchilar", "obunalar", "billing", "audit"]),
  sabab: sababSchema,
});
