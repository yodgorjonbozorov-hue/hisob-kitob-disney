import { z } from "zod";

export const SHARTNOMA_TURLARI = ["mijoz", "taminotchi", "boshqa"] as const;
export type ShartnomaTuri = (typeof SHARTNOMA_TURLARI)[number];

export const SHARTNOMA_TURI_NOMI: Record<ShartnomaTuri, string> = {
  mijoz: "Mijoz bilan",
  taminotchi: "Ta'minotchi bilan",
  boshqa: "Boshqa",
};

export const SHARTNOMA_HOLATLARI = ["faol", "tugagan", "bekor"] as const;
export type ShartnomaHolat = (typeof SHARTNOMA_HOLATLARI)[number];

export const SHARTNOMA_HOLAT_NOMI: Record<ShartnomaHolat, string> = {
  faol: "Faol",
  tugagan: "Tugagan",
  bekor: "Bekor qilingan",
};

/** Ilova biriktirish mumkin bo'lgan yozuv turlari. */
export const ILOVA_ENTITYLARI = ["transaction", "debt", "deal", "task", "contract"] as const;
export type IlovaEntity = (typeof ILOVA_ENTITYLARI)[number];

const sanaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda");

export const createContractSchema = z.object({
  raqam: z.string().trim().min(1, "Shartnoma raqami kiritilishi shart").max(60),
  nomi: z.string().trim().min(1, "Shartnoma nomi kiritilishi shart").max(200),
  turi: z.enum(SHARTNOMA_TURLARI).default("mijoz"),
  contactId: z.string().min(1).optional().nullable(),
  supplierId: z.string().min(1).optional().nullable(),
  kontragent: z.string().trim().max(150).optional().nullable(),
  summa: z.number().int().min(0).max(2_000_000_000).default(0),
  boshlanish: sanaSchema,
  tugash: sanaSchema.optional().nullable(),
  eslatmaKun: z.number().int().min(0).max(365).default(30),
  izoh: z.string().trim().max(1000).optional().nullable(),
});

export const updateContractSchema = createContractSchema.partial().extend({
  holat: z.enum(SHARTNOMA_HOLATLARI).optional(),
});

/** Tashqi havola sifatida biriktirish — saqlagich talab qilmaydi. */
export const havolaIlovaSchema = z.object({
  entity: z.enum(ILOVA_ENTITYLARI),
  entityId: z.string().min(1),
  nomi: z.string().trim().min(1, "Hujjat nomini yozing").max(200),
  url: z.string().trim().min(1, "Havola kiritilishi shart").max(2000),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type HavolaIlovaInput = z.infer<typeof havolaIlovaSchema>;
