import { z } from "zod";
import { SHAXS_TURLARI } from "@/lib/moliya/shaxs";
import { PUL_USULLARI } from "@/lib/moliya/usul";

/**
 * "PUL OLDIM / PUL BERDIM" formasining sxemasi.
 *
 * Pul HAR DOIM `Int` (so'm) — loyiha invarianti. Summa brauzerdan matn
 * ko'rinishida kelishi mumkin (bo'shliqli "2 000 000"), shuning uchun u
 * FORMADA emas, shu yerda tozalanadi: yagona joy bo'lsa route va bot bir
 * xil qoidadan yuradi.
 */

const summaMaydoni = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : Number(String(v).replace(/\s/g, ""))))
  .refine((v) => Number.isInteger(v) && v > 0, "Summa butun va noldan katta bo'lishi kerak")
  .refine((v) => v <= 100_000_000_000, "Summa juda katta");

const sanaMaydoni = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Sana formati YYYY-MM-DD bo'lishi kerak")
  .optional()
  .nullable();

/**
 * SABAB YOKI KATEGORIYA — ikkalasidan biri SHART.
 * `sababKod` — tayyor ro'yxatdan (lib/moliya/sabablar.ts), `categoryId` —
 * direktor o'zi qo'shgan kategoriya. Ikkalasi ham bo'lmasa yozuv qaysi
 * hisobot kesimiga tushishi noma'lum bo'lib qolardi.
 */
const asos = z.object({
  yonalish: z.enum(["kirim", "chiqim"]),
  shaxsTuri: z.enum(SHAXS_TURLARI),
  shaxsId: z.string().min(1).optional().nullable(),
  shaxsIsm: z.string().trim().max(120).optional().nullable(),
  sababKod: z.string().min(1).max(40).optional().nullable(),
  categoryId: z.string().min(1).optional().nullable(),
  summa: summaMaydoni,
  sana: sanaMaydoni,
  usul: z.enum(PUL_USULLARI),
  accountId: z.string().min(1).optional().nullable(),
  izoh: z.string().trim().max(500).optional().nullable(),
});

function sababTekshir(
  d: { sababKod?: string | null; categoryId?: string | null },
  ctx: z.RefinementCtx
) {
  if (!d.sababKod && !d.categoryId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sababni tanlang", path: ["sababKod"] });
  }
}

export const pulHarakatiSchema = asos
  .extend({
    /** Takror yuborishdan himoya — klient har oqim uchun bitta kalit yaratadi. */
    amalId: z.string().min(8).max(80),
  })
  .superRefine(sababTekshir);

export const pulHarakatiTahrirSchema = asos
  .extend({
    sabab: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine(sababTekshir);

export const pulHarakatiBekorSchema = z.object({
  sabab: z.string().trim().max(300).optional().nullable(),
});

export type PulHarakatiInput = z.infer<typeof pulHarakatiSchema>;
export type PulHarakatiTahrirInput = z.infer<typeof pulHarakatiTahrirSchema>;
