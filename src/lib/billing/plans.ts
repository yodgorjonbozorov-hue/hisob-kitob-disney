/** Tarif rejalari. Hozircha bitta STANDARD; keyinchalik shu ro'yxatga qo'shiladi. */
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
    oylikNarx: 199_000,
    tavsif: "Cheksiz biznes, foydalanuvchi va tranzaksiya · Hisobotlar (PDF/Excel) · Telegram bot",
    modullar: ["MOLIYA", "OMBOR"],
  },
  {
    code: "PRO",
    nomi: "Pro",
    oylikNarx: 399_000,
    tavsif: "Standart'dagi hammasi + CRM (bitimlar kanbani, kontaktlar, faoliyat tarixi)",
    modullar: ["MOLIYA", "OMBOR", "CRM"],
  },
];

export function planByCode(code: string): Plan | null {
  return PLANLAR.find((p) => p.code === code) ?? null;
}

/** Obuna davri uzunligi (kun). */
export const OBUNA_DAVRI_KUN = 30;
