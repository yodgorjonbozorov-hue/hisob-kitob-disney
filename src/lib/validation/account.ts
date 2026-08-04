import { z } from "zod";

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

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
