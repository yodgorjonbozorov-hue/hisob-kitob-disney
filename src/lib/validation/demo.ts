import { z } from "zod";

/** Formadagi biznes turi variantlari (oxirgisi — erkin matn uchun). */
export const BIZNES_TURLARI = [
  "Do'kon / market",
  "Umumiy ovqatlanish (kafe, restoran)",
  "Xizmat ko'rsatish",
  "Ishlab chiqarish",
  "Savdo / ulgurji",
  "Boshqa",
];

export const demoRequestSchema = z.object({
  ism: z.string().trim().min(1, "Ismingizni kiriting").max(100),
  telefon: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{9,17}$/, "Telefon raqam noto'g'ri (masalan: +998901234567)"),
  biznesTuri: z.string().trim().min(2, "Biznes turini tanlang").max(100),
  izoh: z.string().trim().max(1000).optional(),
});

export type DemoRequestInput = z.infer<typeof demoRequestSchema>;
