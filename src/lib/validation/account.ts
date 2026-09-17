import { z } from "zod";
import { ONLINE_KANALLAR } from "@/lib/crm/tolovlar";

/** Kassa turlari — UI va API bir xil ro'yxatdan foydalanadi. */
export const ACCOUNT_TURLARI = ["naqd", "plastik", "bank"] as const;
export type AccountTuri = (typeof ACCOUNT_TURLARI)[number];

export const ACCOUNT_TURI_NOMI: Record<AccountTuri, string> = {
  naqd: "Naqd kassa",
  plastik: "Plastik (terminal)",
  bank: "Bank hisob-raqami",
};

export const createAccountSchema = z.object({
  nomi: z.string().trim().min(1, "Nomi kiritilishi shart").max(60),
  turi: z.enum(ACCOUNT_TURLARI),
  tartib: z.number().int().min(0).max(999).optional(),
});

export const updateAccountSchema = z.object({
  nomi: z.string().trim().min(1, "Nomi kiritilishi shart").max(60).optional(),
  turi: z.enum(ACCOUNT_TURLARI).optional(),
  isActive: z.boolean().optional(),
  tartib: z.number().int().min(0).max(999).optional(),
});

export const transferSchema = z
  .object({
    fromAccountId: z.string().min(1, "Qaysi kassadan olinishini tanlang"),
    toAccountId: z.string().min(1, "Qaysi kassaga o'tkazilishini tanlang"),
    summa: z.number().int().positive("Summa musbat bo'lishi kerak"),
    sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda"),
    izoh: z.string().max(300).optional().nullable(),
  })
  .refine((d) => d.fromAccountId !== d.toAccountId, {
    message: "Bitta kassaning o'ziga ko'chirib bo'lmaydi",
    path: ["toAccountId"],
  });

/**
 * FOYDALANUVCHIDAN FOYDALANUVCHIGA PUL O'TKAZISH (PRO).
 *
 * Qabul qiluvchi KASSA emas, FOYDALANUVCHI tanlanadi — uning shaxsiy kassasi
 * server tomonda topiladi (yo'q bo'lsa avtomatik ochiladi). Yuboruvchi kassa
 * berilmasa — joriy foydalanuvchining shaxsiy kassasi.
 */
export const userTransferSchema = z.object({
  toUserId: z.string().min(1, "Kimga pul berilishini tanlang"),
  fromAccountId: z.string().optional().nullable(),
  summa: z.number().int().positive("Summa musbat bo'lishi kerak"),
  sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda"),
  izoh: z.string().max(300).optional().nullable(),
});

/**
 * O'TKAZMA HOLATLARI.
 *
 * Qoldiqqa faqat `QOLDIQ_HOLATLARI` kiradi. "bekor" ataylab ichida: uni
 * qarama-qarshi storno qatori nolga chiqaradi (ledger append-only). "kutilmoqda"
 * va "rad" esa hech qachon pul ko'chirmagan.
 *
 * "arxiv" — eski CashHandover tizimidan ko'chirilgan tarix. Legacy tizim
 * ledgerga ataylab tegmasdi, shuning uchun bu qatorlar ham qoldiqni
 * o'zgartirmaydi (ular ustiga qo'shimcha himoya: migratsiya from = to
 * qo'yadi, ya'ni filtr unutilsa ham ta'sir nol bo'ladi).
 */
export const TRANSFER_HOLATLARI = ["bajarildi", "kutilmoqda", "rad", "bekor", "arxiv"] as const;
export type TransferHolat = (typeof TRANSFER_HOLATLARI)[number];
export const QOLDIQ_HOLATLARI: readonly TransferHolat[] = ["bajarildi", "bekor"];

/** O'tkazma turi — faqat ko'rsatish uchun, pul harakati ikkalasida bir xil. */
export const TRANSFER_TURLARI = ["transfer", "smena"] as const;
export type TransferTuri = (typeof TRANSFER_TURLARI)[number];

export const TRANSFER_TURI_NOMI: Record<TransferTuri, string> = {
  transfer: "Pul o'tkazish",
  smena: "Smena topshirish",
};

/**
 * Kassadan kassaga o'tkazma yaratish (yangi oqim).
 *
 * `toAccountId` — qabul qiluvchi kassa. Yuboruvchi kassa berilmasa, shaxsiy
 * kassa rejimidagi bizneste joriy foydalanuvchining kassasi olinadi.
 */
export const kassaTransferSchema = z
  .object({
    fromAccountId: z.string().min(1).optional().nullable(),
    toAccountId: z.string().min(1, "Qaysi kassaga o'tkazilishini tanlang"),
    /**
     * NAQD summa (so'm) — pul HAQIQATDA shu miqdorda ko'chadi.
     *
     * Nol ATAYLAB ruxsat etiladi (ilgari faqat musbat edi): kassa
     * topshirishda xodim faqat ONLINE kanalni (Click/Payme) belgilashi
     * mumkin — naqd yo'q, lekin online tushum hisobot sifatida
     * topshiriladi. Nol summa ledgerga tegmaydi va naqd smenani yopmaydi
     * (`lib/queries/kassaSmena.ts`). Oddiy o'tkazmada nol summaning ma'nosi
     * yo'q — pastdagi `refine` uni rad etadi.
     */
    summa: z.number().int().min(0, "Summa manfiy bo'lmasligi kerak"),
    turi: z.enum(TRANSFER_TURLARI).optional(),
    izoh: z.string().max(300).optional().nullable(),
    /**
     * TOPSHIRILAYOTGAN ONLINE KANALLAR (faqat `turi = "smena"`).
     * Xodim FAQAT kanalni tanlaydi — summani server o'zi hisoblaydi
     * (`lib/queries/topshirishKanali.ts`), shuning uchun bu yerda summa
     * YO'Q: "taxminiy Click summasi" kiritish yo'li ochiq qolmasin.
     */
    kanallar: z
      .array(z.enum(ONLINE_KANALLAR as [string, ...string[]]))
      .max(ONLINE_KANALLAR.length)
      .optional(),
  })
  .refine((d) => d.summa > 0 || (d.turi === "smena" && (d.kanallar?.length ?? 0) > 0), {
    message: "Topshiriladigan summa yoki online kanal tanlansin",
    path: ["summa"],
  });

/** Kutilayotgan o'tkazma bo'yicha qaror. */
export const transferQarorSchema = z.object({
  amal: z.enum(["qabul", "rad", "bekor"]),
  qarorIzoh: z.string().max(300).optional().nullable(),
});

export type KassaTransferInput = z.infer<typeof kassaTransferSchema>;
export type TransferQarorInput = z.infer<typeof transferQarorSchema>;

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
export type UserTransferInput = z.infer<typeof userTransferSchema>;
