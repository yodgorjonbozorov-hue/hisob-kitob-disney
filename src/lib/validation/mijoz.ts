import { z } from "zod";

export const createMijozSchema = z.object({
  ism: z.string().trim().min(1, "Mijoz ismi kiritilishi shart").max(120),
  tel: z.string().trim().max(50).optional().nullable(),
  telegram: z.string().trim().max(80).optional().nullable(),
  izoh: z.string().trim().max(500).optional().nullable(),
  /** null — chegara yo'q. 0 — umuman qarzga sotilmaydi. */
  qarzLimit: z.number().int().min(0).max(100_000_000_000).optional().nullable(),
});

export const updateMijozSchema = createMijozSchema.partial();

export type CreateMijozInput = z.infer<typeof createMijozSchema>;
export type UpdateMijozInput = z.infer<typeof updateMijozSchema>;
