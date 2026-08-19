/**
 * CLIENT VA SERVER UCHUN UMUMIY TURLAR VA YORLIQLAR.
 *
 * NEGA ALOHIDA FAYL: servis modullari (`support.ts`, `qidiruv.ts`, ...)
 * `rawPrisma` ni import qiladi, ya'ni ular SERVER-ONLY. Client komponent
 * ulardan atigi bitta yorliq xaritasini olsa ham, butun `pg`/Prisma zanjiri
 * brauzer paketiga tortilib build yiqiladi.
 *
 * Shu sababli sof (bog'liqliksiz) turlar va yorliqlar shu faylda turadi.
 * Bu yerga BAZAGA murojaat qiladigan kod QO'SHILMAYDI.
 */

// --- Support ---------------------------------------------------------------

export const HOLATLAR = ["OCHIQ", "KUTILMOQDA", "YECHILDI", "YOPILDI"] as const;
export const MUHIMLIKLAR = ["PAST", "ORTA", "YUQORI", "KRITIK"] as const;

export type TiketHolat = (typeof HOLATLAR)[number];
export type TiketMuhimlik = (typeof MUHIMLIKLAR)[number];

export const HOLAT_LABEL: Record<string, string> = {
  OCHIQ: "Ochiq",
  KUTILMOQDA: "Javob kutilmoqda",
  YECHILDI: "Yechildi",
  YOPILDI: "Yopilgan",
};

export const MUHIMLIK_LABEL: Record<string, string> = {
  PAST: "Past",
  ORTA: "O'rta",
  YUQORI: "Yuqori",
  KRITIK: "Kritik",
};

// --- Global qidiruv --------------------------------------------------------

export type NatijaTuri = "biznes" | "foydalanuvchi" | "tolov" | "obuna" | "audit";

export interface QidiruvNatija {
  turi: NatijaTuri;
  id: string;
  sarlavha: string;
  izoh: string;
  href: string;
}

const TUR_LABEL: Record<NatijaTuri, string> = {
  biznes: "Kompaniya",
  foydalanuvchi: "Foydalanuvchi",
  tolov: "To'lov",
  obuna: "Obuna",
  audit: "Audit",
};

export function turLabel(turi: NatijaTuri): string {
  return TUR_LABEL[turi];
}
