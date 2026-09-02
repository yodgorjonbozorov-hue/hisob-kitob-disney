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
  nomi: z.string().trim().min(1, "Lavozim nomi kiritilsin").max(60),
  turi: z.enum(KATEGORIYA_TURLARI).default("ijrochi"),
  tartib: z.number().int().min(0).max(1000).optional(),
  /** Zakaz formasida chiqadimi (default — ha). */
  zakazgaBiriktiriladi: z.boolean().optional(),
  /** Bir zakazga bir nechta xodim (multi-select). */
  kopXodim: z.boolean().optional(),
});

export const kategoriyaPatchSchema = z.object({
  nomi: z.string().trim().min(1, "Lavozim nomi kiritilsin").max(60).optional(),
  turi: z.enum(KATEGORIYA_TURLARI).optional(),
  aktiv: z.boolean().optional(),
  tartib: z.number().int().min(0).max(1000).optional(),
  zakazgaBiriktiriladi: z.boolean().optional(),
  kopXodim: z.boolean().optional(),
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
 * Zakaz xodimlari ro'yxati. Bir lavozimga bir nechta xodim ham keladi
 * (Videochilar: Sardor, Bekzod) — bir nechtasi ruxsatmi, server lavozimning
 * `kopXodim` bayrog'i bo'yicha tekshiradi.
 */
export const zakazXodimlariSchema = z.array(zakazXodimSchema).max(50);

/** Baho 1..10 (butun). */
const bahoSchema = z.number().int().min(1, "Baho 1 dan 10 gacha").max(10, "Baho 1 dan 10 gacha");

/**
 * ZAKAZ SIFAT NAZORATI: umumiy servis bahosi + e'tiroz + xulosa (zakaz
 * darajasi) va har biriktiruvga alohida baho (xodim darajasi).
 * `null` — bahoni olib tashlash.
 */
export const zakazBahoSchema = z.object({
  servisBahosi: bahoSchema.nullable().optional(),
  etiroz: z.string().trim().max(1000).nullable().optional(),
  yaxshilash: z.string().trim().max(1000).nullable().optional(),
  xodimBaholari: z
    .array(
      z.object({
        /** DealEmployee.id — biriktiruvning o'zi. */
        id: z.string().trim().min(1),
        baho: bahoSchema.nullable(),
        izoh: z.string().trim().max(500).nullable().optional(),
      })
    )
    .max(50)
    .optional(),
});

export type KategoriyaCreateInput = z.infer<typeof kategoriyaCreateSchema>;
export type KategoriyaPatchInput = z.infer<typeof kategoriyaPatchSchema>;
export type ZakazXodimInput = z.infer<typeof zakazXodimSchema>;
export type ZakazBahoInput = z.infer<typeof zakazBahoSchema>;
