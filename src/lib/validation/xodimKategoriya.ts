import { z } from "zod";

/**
 * Xodim kategoriyalari (yo'nalishlar) va zakaz-xodim biriktiruvi uchun
 * validatsiya sxemalari.
 */

/** KPI uslubi — kategoriya NOMIGA emas, shu maydonga bog'lanadi. */
export const KATEGORIYA_TURLARI = ["sotuvchi", "ijrochi"] as const;
export type KategoriyaTuri = (typeof KATEGORIYA_TURLARI)[number];

export const KATEGORIYA_TURI_NOMI: Record<KategoriyaTuri, string> = {
  sotuvchi: "Sotuv (savdo KPI)",
  ijrochi: "Ijro (bajarilgan ish KPI)",
};

export const kategoriyaCreateSchema = z.object({
  nomi: z.string().trim().min(1, "Kategoriya nomi kiritilsin").max(60),
  turi: z.enum(KATEGORIYA_TURLARI).default("ijrochi"),
  tartib: z.number().int().min(0).max(1000).optional(),
});

export const kategoriyaPatchSchema = z.object({
  nomi: z.string().trim().min(1, "Kategoriya nomi kiritilsin").max(60).optional(),
  turi: z.enum(KATEGORIYA_TURLARI).optional(),
  aktiv: z.boolean().optional(),
  tartib: z.number().int().min(0).max(1000).optional(),
});

/** A'zolikni TO'LIQ almashtirish — tanlangan xodimlar ro'yxati. */
export const kategoriyaAzolarSchema = z.object({
  employeeIds: z.array(z.string().trim().min(1)).max(200),
});

/** Zakazdagi bitta biriktiruv: kategoriya + xodim. */
export const zakazXodimSchema = z.object({
  categoryId: z.string().trim().min(1),
  employeeId: z.string().trim().min(1),
});

/**
 * Zakaz xodimlari ro'yxati. Hozircha UI bir kategoriyaga bitta xodim beradi,
 * lekin sxema/baza bir nechtasini ham qabul qiladi (kelajak uchun).
 */
export const zakazXodimlariSchema = z.array(zakazXodimSchema).max(50);

export type KategoriyaCreateInput = z.infer<typeof kategoriyaCreateSchema>;
export type KategoriyaPatchInput = z.infer<typeof kategoriyaPatchSchema>;
export type ZakazXodimInput = z.infer<typeof zakazXodimSchema>;
