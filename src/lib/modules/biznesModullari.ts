import { MODULLAR, modulByCode, type ModulTarifi } from "./registry";

/**
 * BIR BIZNESDA HAQIQATDA ISHLAYDIGAN MODULLAR.
 *
 * Balansada modul ikki qavatli:
 *   · TENANT qavati — `TenantModule` (Sozlamalar → Modullar, faqat direktor);
 *   · BIZNES qavati — `Business.omborli` va `Business.magazin` bayroqlari.
 * Menyu (registry.computeNav) ikkalasini birga o'qiydi. Bu funksiya AYNAN
 * o'sha qoidani takrorlaydi, shuning uchun Bizneslar sahifasidagi "Modullar"
 * ustuni menyu bilan hech qachon qarama-qarshi bo'lmaydi.
 *
 * YANGI modul tizimi EMAS — mavjud registry va bayroqlarning ko'rinishi.
 */

export interface BiznesBayroqlari {
  omborli: boolean;
  magazin: boolean;
}

/** Qisqa yorliq — jadval va kartochkadagi chip uchun (uzun nom sig'maydi). */
const QISQA_NOM: Record<string, string> = {
  MOLIYA: "Moliya",
  OMBOR: "Ombor",
  MAGAZIN: "Kassa",
  KUNLIK: "Kunlik",
  XARID: "Xarid",
  TASDIQLASH: "Tasdiqlash",
  MIJOZLAR: "Mijozlar",
  HR: "Xodimlar",
  HUJJATLAR: "Hujjatlar",
  CRM: "CRM",
  VAZIFALAR: "Vazifalar",
  AI: "AI",
};

export function modulQisqaNomi(code: string): string {
  return QISQA_NOM[code] ?? modulByCode(code)?.nomi ?? code;
}

/**
 * Modul shu bizneste ishlayaptimi.
 *
 * `yoqilgan` — tenant uchun yoqilgan modul kodlari (core'lar kiritilgan,
 * lib/modules/guard.ts → getEnabledModules).
 */
export function modulIshlaydimi(
  m: ModulTarifi,
  yoqilgan: ReadonlySet<string>,
  bayroq: BiznesBayroqlari
): boolean {
  if (m.korinmas) return false;
  if (!m.core && !yoqilgan.has(m.code)) return false;
  if (m.code === "OMBOR") return bayroq.omborli;
  // Kassa (POS) ombor ustidagi qatlam — mahsulot va qoldiq o'sha modulda.
  if (m.code === "MAGAZIN") return bayroq.magazin && bayroq.omborli;
  return true;
}

/** Shu bizneste ishlaydigan modul kodlari (tartib registry bo'yicha). */
export function biznesModulKodlari(
  yoqilgan: ReadonlySet<string>,
  bayroq: BiznesBayroqlari
): string[] {
  return MODULLAR.filter((m) => modulIshlaydimi(m, yoqilgan, bayroq)).map((m) => m.code);
}

/** Chip sifatida chiqadigan qisqa nomlar. */
export function biznesModulNomlari(
  yoqilgan: ReadonlySet<string>,
  bayroq: BiznesBayroqlari
): string[] {
  return biznesModulKodlari(yoqilgan, bayroq).map(modulQisqaNomi);
}
