import { z } from "zod";
import { zakazXodimlariSchema } from "./xodimKategoriya";

/** CRM kunlik buyurtmalari uchun validatsiya sxemalari. */

const sanaRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Yangi buyurtma. Kategoriya — KIRIM modulidagi kategoriya id'si
 * (alohida CRM kategoriya tizimi yo'q). Summa `Int` (so'm), hech qachon float.
 */
export const buyurtmaSchema = z.object({
  nomi: z.string().trim().min(1, "Xizmat/buyurtma nomi kiritilsin").max(200),
  categoryId: z.string().trim().min(1, "Kategoriya tanlansin"),
  summa: z.number().int("Summa butun so'mda bo'lishi kerak").min(0).optional(),
  contactId: z.string().trim().optional().nullable(),
  kontaktIsm: z.string().trim().max(100).optional().nullable(),
  kontaktTel: z.string().trim().max(30).optional().nullable(),
  sana: z.string().regex(sanaRegex, "Sana YYYY-MM-DD ko'rinishida").optional().nullable(),
  muddat: z.string().regex(sanaRegex, "Muddat YYYY-MM-DD ko'rinishida").optional().nullable(),
  izoh: z.string().trim().max(1000).optional().nullable(),
  masulId: z.string().trim().optional().nullable(),
  stageId: z.string().trim().optional().nullable(),
  /**
   * ZAKAZNI OLGAN SOTUVCHI (Employee.id) — birinchi darajali maydon.
   * `masulId` (User) va `xodimlar` (ijrochilar) BILAN ARALASHTIRILMAYDI:
   * bu "mijoz bilan gaplashib zakazni kim oldi" degan javob (38-talab).
   * Berilmasa server foydalanuvchining o'z sotuvchi profilini qo'yadi
   * (avto-tanlash), u ham bo'lmasa — biznes sozlamasiga qarab rad etadi.
   */
  sotuvchiId: z.string().trim().min(1).optional().nullable(),
  /** Zakazdagi xodimlar (kategoriya kesimida). Berilmasa — biriktiruvsiz. */
  xodimlar: zakazXodimlariSchema.optional(),
});

/**
 * Buyurtmani tahrirlash / holatini o'zgartirish.
 * `kirimYoz` — eski xulq (WON bosqichga sudrab o'tkazganda kirim taklifi).
 */
export const buyurtmaPatchSchema = z.object({
  stageId: z.string().trim().optional(),
  kirimYoz: z.boolean().optional(),
  nomi: z.string().trim().min(1).max(200).optional(),
  summa: z.number().int().min(0).optional(),
  categoryId: z.string().trim().optional().nullable(),
  sana: z.string().regex(sanaRegex).optional().nullable(),
  izoh: z.string().trim().max(1000).optional().nullable(),
  masulId: z.string().trim().optional(),
  /**
   * SOTUVCHINI ALMASHTIRISH (Employee.id) — `crm.sotuvchi` huquqi talab
   * qilinadi va o'zgarish audit jurnaliga yoziladi (10/27-talab).
   */
  sotuvchiId: z.string().trim().min(1).optional(),
  /** Zakaz xodimlarini TO'LIQ almashtirish (kirim yozilgach qulflanadi). */
  xodimlar: zakazXodimlariSchema.optional(),
});

/** Kirimga o'tkazish: kassa va to'lov turi ixtiyoriy. */
export const kirimgaSchema = z.object({
  accountId: z.string().trim().optional().nullable(),
  tolovTuri: z.enum(["naqd", "click", "qarz"]).optional().nullable(),
});

export type BuyurtmaInput = z.infer<typeof buyurtmaSchema>;
export type BuyurtmaPatchInput = z.infer<typeof buyurtmaPatchSchema>;
