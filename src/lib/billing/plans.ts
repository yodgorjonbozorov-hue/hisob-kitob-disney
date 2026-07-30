/**
 * Tarif rejalari — narx, nom, tavsif va modullar uchun YAGONA manba.
 * Landing, billing, superadmin va bot shu ro'yxatdan o'qiydi.
 *
 * DIQQAT: narx o'zgarsa tarix retroaktiv o'zgarmaydi — Payment.amount va
 * Subscription.amount yozuv yaratilgan paytdagi summani saqlaydi.
 */
export interface Plan {
  code: string;
  nomi: string;
  /** Oylik narx (so'm). */
  oylikNarx: number;
  tavsif: string;
  /** Bu tarifda ochiq modullar (lib/modules/registry.ts kodlari). Core modullar har doim ochiq. */
  modullar: string[];
}

export const PLANLAR: Plan[] = [
  {
    code: "STANDARD",
    nomi: "Standart",
    oylikNarx: 200_000,
    tavsif: "Cheksiz biznes, foydalanuvchi va tranzaksiya · Hisobotlar (PDF/Excel) · Telegram bot",
    modullar: ["MOLIYA", "OMBOR"],
  },
  {
    code: "PRO",
    nomi: "Pro",
    oylikNarx: 300_000,
    tavsif: "Standart'dagi hammasi + CRM (bitimlar kanbani, kontaktlar) + Vazifalar + AI yordamchi",
    modullar: ["MOLIYA", "OMBOR", "CRM", "VAZIFALAR", "AI"],
  },
];

export function planByCode(code: string): Plan | null {
  return PLANLAR.find((p) => p.code === code) ?? null;
}

/** Obuna davri uzunligi (kun). */
export const OBUNA_DAVRI_KUN = 30;
