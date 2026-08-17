import { z } from "zod";

/**
 * Mobil kirish. `deviceId` — klient bir marta yaratib Keychain'da saqlaydigan
 * UUID. U qurilmani ajratadi: bitta foydalanuvchi telefon va planshetda bir
 * vaqtda ishlashi mumkin, chiqish esa faqat bitta qurilmani yopadi.
 */
export const mobilLoginSchema = z.object({
  login: z.string().trim().min(1, "Login kiritilishi shart"),
  parol: z.string().min(1, "Parol kiritilishi shart"),
  deviceId: z.string().trim().min(8, "deviceId noto'g'ri").max(100),
  /** Foydalanuvchiga ko'rsatish uchun: "Salima iPhone". */
  deviceNom: z.string().trim().max(100).optional(),
});

export const mobilRefreshSchema = z.object({
  refresh: z.string().trim().min(1, "refresh token kerak"),
});

export type MobilLoginInput = z.infer<typeof mobilLoginSchema>;
