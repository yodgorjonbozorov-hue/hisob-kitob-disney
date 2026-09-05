import type { QarzTolovUsuli } from "@/lib/validation/qarz";

/**
 * TO'LOV USULI — foydalanuvchi ko'radigan ro'yxat.
 *
 * MODEL LUG'ATI ATAYLAB KENGAYTIRILMAYDI (lib/crm/tolovlar.ts bilan bir xil
 * qaror): `Transaction.tolovTuri` "naqd" | "click" | "qarz" | null bo'lib
 * qoladi, chunki butun moliya (hisobotlar, kunlik kassa, filtrlar,
 * lib/tolovBolimi.ts) shu uchtasiga qurilgan. Yangi qiymat qo'shilsa har
 * bir hisobot jimgina noto'g'ri javob bera boshlardi.
 *
 * Farq esa YO'QOLMAYDI — u KASSA turiga tushadi (`Account.turi`):
 *   Terminal      → plastik kassa,
 *   Click         → plastik/bank kassa,
 *   Pul o'tkazish → bank kassasi.
 * Ya'ni "pul qayerda" degan savolga kassa javob beradi, "qanday to'landi"
 * degan savolga esa usul — ular allaqachon ikki xil narsa edi.
 */

export const PUL_USULLARI = ["naqd", "terminal", "click", "otkazma"] as const;
export type PulUsuli = (typeof PUL_USULLARI)[number];

export const PUL_USULI_NOMI: Record<PulUsuli, string> = {
  naqd: "Naqd",
  terminal: "Terminal",
  click: "Click",
  otkazma: "Pul o'tkazish",
};

export const PUL_USULI_BELGI: Record<PulUsuli, string> = {
  naqd: "\u{1F4B5}",
  terminal: "\u{1F4B3}",
  click: "\u{1F4B3}",
  otkazma: "\u{1F3E6}",
};

export function isPulUsuli(v: unknown): v is PulUsuli {
  return PUL_USULLARI.includes(v as PulUsuli);
}

/** Usul → `Transaction.tolovTuri`. Naqddan boshqasi kassaga naqdsiz tushadi. */
export function usulTolovTuri(usul: PulUsuli): "naqd" | "click" {
  return usul === "naqd" ? "naqd" : "click";
}

/**
 * Usul → `DebtPayment.tolovTuri` (lib/validation/qarz.ts lug'ati:
 * "naqd" | "click" | "bank"). Pul o'tkazish — bank, terminal esa karta
 * to'lovi bo'lgani uchun Click bilan bir tarafda.
 */
export function usulQarzTolovi(usul: PulUsuli): QarzTolovUsuli {
  if (usul === "naqd") return "naqd";
  if (usul === "otkazma") return "bank";
  return "click";
}

/**
 * Usulga MOS kassa turlari — kassa tanlanmaganda shu tartibda qidiriladi.
 * Bo'sh ro'yxat qaytmaydi: mos kassa topilmasa chaqiruvchi birinchi faol
 * kassaga qaytadi (`resolveAccountId` bilan bir xil qoida).
 */
export function usulKassaTurlari(usul: PulUsuli): string[] {
  if (usul === "naqd") return ["naqd"];
  if (usul === "terminal") return ["plastik", "bank"];
  if (usul === "otkazma") return ["bank", "plastik"];
  return ["plastik", "bank"];
}
