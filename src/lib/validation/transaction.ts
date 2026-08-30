import { z } from "zod";
import { MAX_KG, MAX_KG_NARXI, kgAniqmi } from "@/lib/kg";

/**
 * KG SAVDOSI maydonlari (mijozga xos — Fortex Selos).
 *
 * Miqdor kasr bo'lishi mumkin (12,5 kg), lekin gramm aniqligidan (3 xona)
 * oshmaydi — bazada gramm butun son sifatida saqlanadi (lib/kg.ts).
 * Narx BUTUN so'm va ERKIN: yuqori/pastki chegara YO'Q, faqat musbat bo'lishi
 * shart (mahsulot narxi har savdoda savdolashib belgilanadi).
 */
export const miqdorKgSchema = z
  .number({ invalid_type_error: "Miqdorni kiriting" })
  .finite("Miqdor noto'g'ri")
  .positive("Miqdor 0 dan katta bo'lishi kerak")
  .max(MAX_KG, "Miqdor juda katta")
  .refine(kgAniqmi, "Miqdor eng ko'pi 3 xona (gramm) aniqligida bo'ladi");

export const kgNarxiSchema = z
  .number({ invalid_type_error: "1 kg narxini kiriting" })
  .int("1 kg narxi butun so'mda bo'ladi")
  .positive("1 kg narxi 0 dan katta bo'lishi kerak")
  .max(MAX_KG_NARXI, "1 kg narxi juda katta");

/** Ikkalasi birga keladi — biri berilib, ikkinchisi tushib qolmasin. */
function kgJuftligiToliq(d: { miqdorKg?: number | null; kgNarxi?: number | null }): boolean {
  return (d.miqdorKg == null) === (d.kgNarxi == null);
}

/** Tranzaksiya to'lov turlari. Null (eski yozuvlar) — kassa turidan chiqariladi. */
export const TOLOV_TURLARI = ["naqd", "click", "qarz"] as const;
export type TolovTuri = (typeof TOLOV_TURLARI)[number];

export const TOLOV_NOMI: Record<TolovTuri, string> = {
  naqd: "Naqd",
  click: "Click",
  qarz: "Qarz",
};

export const TOLOV_BELGI: Record<TolovTuri, string> = {
  naqd: "\u{1F4B5}",
  click: "\u{1F4B3}",
  qarz: "\u{1F4CB}",
};

export const createTransactionSchema = z
  .object({
    turi: z.enum(["kirim", "chiqim"]),
    categoryId: z.string().min(1),
    summa: z.number().int().positive("Summa musbat bo'lishi kerak"),
    sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda"),
    /** Qaysi kassaga tushdi. Berilmasa to'lov turiga mos faol kassa olinadi. */
    accountId: z.string().min(1).optional().nullable(),
    /** Berilmasa (eski mijozlar/import) — kassa turidan chiqariladi. */
    tolovTuri: z.enum(TOLOV_TURLARI).optional().nullable(),
    izoh: z.string().max(500).optional().nullable(),
    filial: z.string().max(100).optional().nullable(),
    /**
     * KG SAVDOSI: miqdor (kg) va 1 kg narxi. Berilsa `summa` E'TIBORGA
     * OLINMAYDI — server miqdor × narx bo'yicha qayta hisoblaydi
     * (frontend yuborgan jamiga ishonilmaydi).
     */
    miqdorKg: miqdorKgSchema.optional().nullable(),
    kgNarxi: kgNarxiSchema.optional().nullable(),
    /**
     * SOTUVCHI/XODIM — savdo kimning hisobiga yozilishi (xodim statistikasi).
     * Berilmasa kirimda server joriy foydalanuvchini oladi. Boshqa xodimni
     * tanlash faqat boshqaruvchiga (server tekshiradi — lib/services/sotuvchi.ts).
     */
    sotuvchiId: z.string().min(1).optional().nullable(),
  })
  .refine((d) => !(d.sotuvchiId && d.turi === "chiqim"), {
    message: "Sotuvchi faqat kirim uchun belgilanadi",
  })
  .refine((d) => !(d.tolovTuri === "qarz" && d.turi === "chiqim"), {
    message: "Qarz to'lov turi faqat kirim uchun",
  })
  .refine(kgJuftligiToliq, {
    message: "Kg savdosida miqdor ham, 1 kg narxi ham kiritilishi shart",
  })
  // Kg — SOTUV ko'rsatkichi: chiqimda o'lchov yozib qo'yish hisobotni
  // chalkashtiradi (sotilgan kg manfiy bo'lib ketardi).
  .refine((d) => d.miqdorKg == null || d.turi === "kirim", {
    message: "Kg savdosi faqat kirim uchun",
  });

export const updateTransactionSchema = z
  .object({
    turi: z.enum(["kirim", "chiqim"]).optional(),
    categoryId: z.string().min(1).optional(),
    summa: z.number().int().positive("Summa musbat bo'lishi kerak").optional(),
    sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda").optional(),
    accountId: z.string().min(1).optional().nullable(),
    tolovTuri: z.enum(TOLOV_TURLARI).optional().nullable(),
    izoh: z.string().max(500).optional().nullable(),
    filial: z.string().max(100).optional().nullable(),
    /** Kg savdosini tuzatish: ikkalasi birga yuboriladi, summa qayta hisoblanadi. */
    miqdorKg: miqdorKgSchema.optional().nullable(),
    kgNarxi: kgNarxiSchema.optional().nullable(),
    /** Sotuvchini tuzatish (null — olib tashlash). Faqat boshqaruvchi (route tekshiradi). */
    sotuvchiId: z.string().min(1).optional().nullable(),
  })
  .refine(kgJuftligiToliq, {
    message: "Kg savdosida miqdor ham, 1 kg narxi ham kiritilishi shart",
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
