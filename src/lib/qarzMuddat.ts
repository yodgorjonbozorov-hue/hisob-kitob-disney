/**
 * MUDDAT HOLATI — qarz muddati bo'yicha yagona til.
 *
 * Server ham, brauzer ham AYNI funksiyadan foydalanadi: "muddati o'tgan"
 * degan so'z KPI kartada, filtr chipida va qarzdor kartochkasida bir xil
 * ma'noni bildirishi kerak, aks holda uchta ekranda uchta boshqa raqam
 * chiqardi.
 *
 * Faqat RANGGA tayanilmaydi (12-talab): har holatning MATNI ham bor —
 * rang ko'rmaydigan foydalanuvchi ham holatni o'qiy oladi.
 */
export const MUDDAT_HOLATLARI = [
  "kechikdi",
  "bugun",
  "yaqin",
  "keyin",
  "muddatsiz",
  "yopilgan",
] as const;
export type MuddatHolat = (typeof MUDDAT_HOLATLARI)[number];

/** "Yaqin muddat" chegarasi — shu kun ichida to'lanishi kerak bo'lganlar. */
export const YAQIN_MUDDAT_KUN = 7;

/**
 * Muddat holati va muddatgacha qolgan kun.
 *
 * `kun` — musbat bo'lsa muddatgacha shuncha kun qoldi, manfiy bo'lsa
 * shuncha kun kechikdi, 0 — aynan bugun. Muddat belgilanmagan yoki qarz
 * yopilgan bo'lsa `null`.
 */
export function muddatHolati(
  muddatISO: string | null,
  yopilganmi: boolean,
  bugunISO: string
): { holat: MuddatHolat; kun: number | null } {
  if (yopilganmi) return { holat: "yopilgan", kun: null };
  if (!muddatISO) return { holat: "muddatsiz", kun: null };
  const kun = Math.round(
    (Date.parse(muddatISO.slice(0, 10)) - Date.parse(bugunISO)) / 86_400_000
  );
  if (kun < 0) return { holat: "kechikdi", kun };
  if (kun === 0) return { holat: "bugun", kun };
  if (kun <= YAQIN_MUDDAT_KUN) return { holat: "yaqin", kun };
  return { holat: "keyin", kun };
}

/** Ekrandagi matn — belgi + so'z (rangdan mustaqil o'qiladi). */
export function muddatMatni(holat: MuddatHolat, kun: number | null): string {
  switch (holat) {
    case "kechikdi":
      return `${Math.abs(kun ?? 0)} kun kechikdi`;
    case "bugun":
      return "Bugun to'lashi kerak";
    case "yaqin":
      return `${kun} kun qoldi`;
    case "keyin":
      return `${kun} kun qoldi`;
    case "yopilgan":
      return "Yopilgan";
    default:
      return "Muddat belgilanmagan";
  }
}

export const MUDDAT_BELGI: Record<MuddatHolat, string> = {
  kechikdi: "\u{1F534}",
  bugun: "\u{1F7E0}",
  yaqin: "\u{1F7E1}",
  keyin: "\u{1F7E2}",
  muddatsiz: "\u{26AA}",
  yopilgan: "\u{2705}",
};

/**
 * Qarzdorlar TARTIBI — eng kritigi tepada (14-talab).
 *
 * Tartib: muddati o'tgan → bugun → yaqinlashayotgan → muddatsiz/keyingi.
 * Ichida esa summa bo'yicha: bir xil kritiklikdagi ikki qarzdordan kattasi
 * bilan ish ko'proq.
 */
export const MUDDAT_TARTIBI: Record<MuddatHolat, number> = {
  kechikdi: 0,
  bugun: 1,
  yaqin: 2,
  keyin: 3,
  muddatsiz: 4,
  yopilgan: 5,
};
