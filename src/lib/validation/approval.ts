import { z } from "zod";

/** So'rov holatlari: kutilmoqda → tasdiqlangan yoki rad. */
export const TASDIQ_HOLATLARI = ["kutilmoqda", "tasdiqlangan", "rad"] as const;
export type TasdiqHolat = (typeof TASDIQ_HOLATLARI)[number];

export const TASDIQ_HOLAT_NOMI: Record<TasdiqHolat, string> = {
  kutilmoqda: "Kutilmoqda",
  tasdiqlangan: "Tasdiqlangan",
  rad: "Rad etilgan",
};

/** Qoidani kim tasdiqlaydi. Kassir/sotuvchi tasdiqlovchi bo'la olmaydi. */
export const TASDIQLOVCHI_ROLLAR = ["OWNER", "ADMIN"] as const;

export const createRuleSchema = z.object({
  /** null yoki berilmasa — barcha chiqim kategoriyalari. */
  categoryId: z.string().min(1).optional().nullable(),
  chegara: z
    .number()
    .int("Chegara butun son bo'lishi kerak")
    .positive("Chegara musbat bo'lishi kerak")
    .max(2_000_000_000),
  tasdiqlovchiRol: z.enum(TASDIQLOVCHI_ROLLAR).default("OWNER"),
  izoh: z.string().trim().max(300).optional().nullable(),
});

export const updateRuleSchema = z.object({
  categoryId: z.string().min(1).optional().nullable(),
  chegara: z.number().int().positive().max(2_000_000_000).optional(),
  tasdiqlovchiRol: z.enum(TASDIQLOVCHI_ROLLAR).optional(),
  isActive: z.boolean().optional(),
  izoh: z.string().trim().max(300).optional().nullable(),
});

/** Rad etishda sabab MAJBURIY — xodim nima uchun rad etilganini bilishi kerak. */
export const radEtSchema = z.object({
  sabab: z.string().trim().min(3, "Rad etish sababini yozing").max(300),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
