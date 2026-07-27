/** Tarif rejalari. Hozircha bitta STANDARD; keyinchalik shu ro'yxatga qo'shiladi. */
export interface Plan {
  code: string;
  nomi: string;
  /** Oylik narx (so'm). */
  oylikNarx: number;
  tavsif: string;
}

export const PLANLAR: Plan[] = [
  {
    code: "STANDARD",
    nomi: "Standart",
    oylikNarx: 199_000,
    tavsif: "Cheksiz biznes, foydalanuvchi va tranzaksiya · Hisobotlar (PDF/Excel) · Telegram bot",
  },
];

export function planByCode(code: string): Plan | null {
  return PLANLAR.find((p) => p.code === code) ?? null;
}

/** Obuna davri uzunligi (kun). */
export const OBUNA_DAVRI_KUN = 30;
