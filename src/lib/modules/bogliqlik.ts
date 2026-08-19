import { MODULLAR, modulByCode, type ModulTarifi } from "./registry";

/**
 * MODUL BOG'LIQLIGI (Superadmin 2.0, talab 13).
 *
 * Ayrim modullar boshqasisiz ishlamaydi. Ilgari bu bilim faqat odamning
 * boshida edi: modul o'chirilsa ikkinchisi jimgina sinardi. Endi bog'liqlik
 * ochiq e'lon qilinadi va superadmin panelida MAJBURLANADI.
 *
 * QOIDA: bu yerga faqat KODDA HAQIQATAN mavjud bog'liqlik yoziladi.
 * "Chiroyli grafik" uchun o'ylab topilgan bog'liqlik qo'shilmaydi — u
 * mijozning modulini sababsiz bloklab qo'yardi.
 */

/**
 * `modul -> u talab qiladigan modullar`.
 *
 * XARID → OMBOR: xarid buyurtmasi QABUL QILINGANDA tovar omborga tushadi
 * (`lib/services/xarid.ts` → `product` / `stockEntry` yozuvlari). Ombor
 * yopiq bo'lsa qabul qilish amali ma'nosini yo'qotadi.
 *
 * Core modullar (MOLIYA, BOSHQARUV) bu yerga yozilmaydi — ular har doim yoqiq.
 */
export const MODUL_BOGLIQLIGI: Record<string, string[]> = {
  XARID: ["OMBOR"],
};

/** Shu modul ishlashi uchun kerak bo'lgan modullar (to'g'ridan-to'g'ri). */
export function talabQiladi(code: string): string[] {
  return MODUL_BOGLIQLIGI[code] ?? [];
}

/** Shu modulga TAYANADIGAN modullar (teskari yo'nalish). */
export function tayanadiganlar(code: string): string[] {
  return Object.entries(MODUL_BOGLIQLIGI)
    .filter(([, kerak]) => kerak.includes(code))
    .map(([modul]) => modul);
}

export interface BogliqlikNatija {
  ok: boolean;
  /** Foydalanuvchiga ko'rsatiladigan tushuntirish (o'zbekcha). */
  xabar: string | null;
  /** Muammoga sabab bo'lgan modul kodlari. */
  modullar: string[];
}

function nomi(code: string): string {
  return modulByCode(code)?.nomi ?? code;
}

/**
 * Modulni YOQISH mumkinmi: u talab qiladigan modullar yoqiqmi.
 * `yoqilgan` — hozir yoqiq modullar to'plami (core'lar kiritilgan).
 */
export function yoqishMumkinmi(code: string, yoqilgan: ReadonlySet<string>): BogliqlikNatija {
  const yetishmayotgan = talabQiladi(code).filter((k) => !yoqilgan.has(k));
  if (yetishmayotgan.length === 0) return { ok: true, xabar: null, modullar: [] };
  const royxat = yetishmayotgan.map(nomi).join(", ");
  return {
    ok: false,
    xabar: `"${nomi(code)}" ishlashi uchun avval "${royxat}" moduli yoqilgan bo'lishi kerak.`,
    modullar: yetishmayotgan,
  };
}

/**
 * Modulni O'CHIRISH mumkinmi: unga tayanadigan yoqiq modul qolmaganmi.
 * Yashirincha ikkalasini o'chirib yubormaydi — sabab tushuntiriladi.
 */
export function ochirishMumkinmi(code: string, yoqilgan: ReadonlySet<string>): BogliqlikNatija {
  const bogliqlar = tayanadiganlar(code).filter((m) => yoqilgan.has(m));
  if (bogliqlar.length === 0) return { ok: true, xabar: null, modullar: [] };
  const royxat = bogliqlar.map(nomi).join(", ");
  return {
    ok: false,
    xabar: `"${nomi(code)}" ni o'chirib bo'lmaydi: unga "${royxat}" moduli tayanadi. Avval o'shani o'chiring.`,
    modullar: bogliqlar,
  };
}

/** Panelda ko'rsatiladigan bog'liqlik grafigi (kod + nom + talablar). */
export interface BogliqlikTuguni {
  code: string;
  nomi: string;
  talablar: string[];
  tayanadiganlar: string[];
}

export function bogliqlikGrafigi(): BogliqlikTuguni[] {
  return MODULLAR.filter((m: ModulTarifi) => !m.korinmas).map((m) => ({
    code: m.code,
    nomi: m.nomi,
    talablar: talabQiladi(m.code),
    tayanadiganlar: tayanadiganlar(m.code),
  }));
}
