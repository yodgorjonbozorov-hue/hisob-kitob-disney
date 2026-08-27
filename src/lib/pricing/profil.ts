/**
 * BIZNES YO'NALISHI (sanoat) PROFILLARI — "Bitta Balansa. Har qanday biznesga mos."
 *
 * ASOSIY QOIDA: yo'nalish NARXNI O'ZGARTIRMAYDI. Bir xil filial soni va bir xil
 * modullar tanlagan oziq-ovqat va xizmat biznesi BIR XIL to'laydi. Yo'nalish
 * faqat moslashtiradi: boshlang'ich konfiguratsiya, tavsiya etiladigan
 * modullar va onboarding qadamlari.
 *
 * Bu — lib/biznesFaoliyati.ts dagi "faoliyat" tushunchasining ommaviy
 * (marketing/onboarding) qatlami: har yo'nalish o'sha boshlang'ich
 * bayroqlarga (turi/omborli/magazin) o'giriladi, jadval va hisob mantiqi
 * BITTA bo'lib qoladi — sanoat uchun alohida sxema yaratilmaydi.
 *
 * Client va server ikkalasida ishlatiladi — server-only import qo'shilmasin.
 */

import type { AddonKey } from "./config";

export type BusinessType =
  | "auto"
  | "perfume"
  | "food"
  | "agro"
  | "service"
  | "wholesale"
  | "manufacturing"
  | "other";

export const BUSINESS_TYPES: BusinessType[] = [
  "auto",
  "perfume",
  "food",
  "agro",
  "service",
  "wholesale",
  "manufacturing",
  "other",
];

export function isBusinessType(v: unknown): v is BusinessType {
  return typeof v === "string" && (BUSINESS_TYPES as string[]).includes(v);
}

/** Onboarding qadami — birinchi kirishdagi "3 foydali qadam" ro'yxati. */
export interface OnboardingQadam {
  /** Bajarilganlik shu kalit bo'yicha serverda tekshiriladi. */
  kalit: "mahsulot" | "import" | "sotuv" | "mijoz" | "buyurtma" | "tranzaksiya" | "xarid";
  label: string;
  href: string;
}

export interface BiznesProfil {
  code: BusinessType;
  label: string;
  /** Kimlar uchun — landing/tariflar kartasidagi qisqa izoh. */
  tavsif: string;
  /** Lucide ikonka nomi (LandingNav ishlatadigan to'plamdan). */
  icon: string;
  /** Tariflar sahifasida ko'rsatiladigan moslashtirilgan tushuntirish. */
  tavsiyaMatni: string;
  /** "Sizga tavsiya etiladi" belgisi qo'yiladigan modullar. AVTOMATIK YOQILMAYDI. */
  tavsiyaAddons: AddonKey[];
  /** Boshlang'ich biznes bayroqlari (lib/biznesFaoliyati.ts bilan bir xil ma'no). */
  boshlangich: {
    turi: "umumiy" | "avto";
    omborli: boolean;
    magazin: boolean;
  };
  /** Ushbu yo'nalishda Balansa nimalarga urg'u beradi (landing kartasi ro'yxati). */
  urgular: string[];
  /** Birinchi kirishdagi shaxsiylashtirilgan qadamlar (3 ta). */
  onboarding: OnboardingQadam[];
}

const QADAM = {
  mahsulot: { kalit: "mahsulot", label: "Birinchi mahsulotni kiritish", href: "/app/ombor" },
  import: { kalit: "import", label: "Excel'dan import qilish", href: "/app/ombor?import=1" },
  sotuv: { kalit: "sotuv", label: "Birinchi savdoni amalga oshirish", href: "/app/sotuv" },
  mijoz: { kalit: "mijoz", label: "Birinchi mijozni qo'shish", href: "/app/crm/kontaktlar" },
  buyurtma: { kalit: "buyurtma", label: "Buyurtma yaratish", href: "/app/crm" },
  tranzaksiya: { kalit: "tranzaksiya", label: "Birinchi kirim yoki chiqimni yozish", href: "/app/tranzaksiyalar" },
  xarid: { kalit: "xarid", label: "Kelgan tovarni kiritish", href: "/app/ombor?tab=taminotlar" },
} satisfies Record<string, OnboardingQadam>;

export const BIZNES_PROFILLAR: Record<BusinessType, BiznesProfil> = {
  auto: {
    code: "auto",
    label: "Avto",
    tavsif: "Ehtiyot qismlar, avtoservis, shina do'koni, avto savdo.",
    icon: "car",
    tavsiyaMatni:
      "Avto biznes uchun savdo, ombor, qarzdorlik va kassa funksiyalari tavsiya etiladi.",
    tavsiyaAddons: ["telegram"],
    boshlangich: { turi: "umumiy", omborli: true, magazin: false },
    urgular: ["Savdo", "Ombor", "Qarzdorlik", "Kassa"],
    onboarding: [QADAM.mahsulot, QADAM.sotuv, QADAM.tranzaksiya],
  },
  perfume: {
    code: "perfume",
    label: "Parfumeriya",
    tavsif: "Atir-upa va kosmetika do'konlari.",
    icon: "sparkles",
    tavsiyaMatni:
      "Parfumeriya savdosi uchun shtrix-kodli kassa (POS) va ombor funksiyalari tavsiya etiladi.",
    tavsiyaAddons: ["pos"],
    boshlangich: { turi: "umumiy", omborli: true, magazin: true },
    urgular: ["Mahsulotlar", "Shtrix-kod", "Ombor", "Kassa"],
    onboarding: [QADAM.mahsulot, QADAM.import, QADAM.sotuv],
  },
  food: {
    code: "food",
    label: "Oziq-ovqat",
    tavsif: "Oziq-ovqat do'konlari va chakana savdo.",
    icon: "store",
    tavsiyaMatni:
      "Oziq-ovqat savdosi uchun POS, shtrix-kod va ombor funksiyalari tavsiya etiladi.",
    tavsiyaAddons: ["pos"],
    boshlangich: { turi: "umumiy", omborli: true, magazin: true },
    urgular: ["POS kassa", "Shtrix-kod", "Ombor", "Qaytarish"],
    onboarding: [QADAM.mahsulot, QADAM.import, QADAM.sotuv],
  },
  agro: {
    code: "agro",
    label: "Agro",
    tavsif: "Qishloq xo'jaligi mahsulotlari savdosi.",
    icon: "wheat",
    tavsiyaMatni:
      "Agro biznes uchun kg/birlik savdosi, ombor va ta'minotchi-mijoz qarzdorligi tavsiya etiladi.",
    tavsiyaAddons: ["omborPlus", "telegram"],
    boshlangich: { turi: "umumiy", omborli: true, magazin: false },
    urgular: ["Kg/birlik savdosi", "Ombor", "Qarzdorlik", "Pul oqimi"],
    onboarding: [QADAM.mahsulot, QADAM.xarid, QADAM.sotuv],
  },
  service: {
    code: "service",
    label: "Xizmat ko'rsatish",
    tavsif: "Servis, ta'lim, go'zallik, ta'mirlash va boshqa xizmatlar.",
    icon: "handshake",
    tavsiyaMatni:
      "Xizmat biznesi uchun CRM, buyurtmalar va mijoz-qarz boshqaruvi tavsiya etiladi.",
    tavsiyaAddons: ["crm"],
    boshlangich: { turi: "umumiy", omborli: false, magazin: false },
    urgular: ["CRM", "Buyurtmalar", "Mijozlar", "Qarzdorlik"],
    onboarding: [QADAM.mijoz, QADAM.buyurtma, QADAM.tranzaksiya],
  },
  wholesale: {
    code: "wholesale",
    label: "Optom savdo",
    tavsif: "Ulgurji savdo va distributsiya.",
    icon: "boxes",
    tavsiyaMatni:
      "Optom savdo uchun ombor, mijoz qarzdorligi va xarid funksiyalari tavsiya etiladi.",
    tavsiyaAddons: ["omborPlus", "crm"],
    boshlangich: { turi: "umumiy", omborli: true, magazin: false },
    urgular: ["Ombor", "Mijoz qarzlari", "Savdo", "Xarid"],
    onboarding: [QADAM.mahsulot, QADAM.sotuv, QADAM.xarid],
  },
  manufacturing: {
    code: "manufacturing",
    label: "Ishlab chiqarish",
    tavsif: "Kichik ishlab chiqarish va sex.",
    icon: "factory",
    tavsiyaMatni:
      "Ishlab chiqarish uchun ombor, xarid va kirim-chiqim nazorati tavsiya etiladi.",
    tavsiyaAddons: ["omborPlus"],
    boshlangich: { turi: "umumiy", omborli: true, magazin: false },
    urgular: ["Ombor", "Xarid", "Kirim-chiqim", "Hisobot"],
    onboarding: [QADAM.mahsulot, QADAM.xarid, QADAM.tranzaksiya],
  },
  other: {
    code: "other",
    label: "Boshqa",
    tavsif: "Har qanday boshqa biznes — Balansa moslashadi.",
    icon: "briefcase",
    tavsiyaMatni:
      "Balansa asosiy tizimi kirim-chiqim, kassa va qarzdorlik bilan darhol ishlaydi — kerakli modullarni keyin yoqasiz.",
    tavsiyaAddons: [],
    boshlangich: { turi: "umumiy", omborli: false, magazin: false },
    urgular: ["Kirim-chiqim", "Kassa", "Qarzdorlik", "Hisobot"],
    onboarding: [QADAM.tranzaksiya, QADAM.mijoz, QADAM.sotuv],
  },
};

export function biznesProfil(code: string | null | undefined): BiznesProfil | null {
  return isBusinessType(code) ? BIZNES_PROFILLAR[code] : null;
}

/**
 * Yo'nalish bo'yicha onboarding qadamlari — profil topilmasa universal to'plam.
 * Ombori yo'q biznesga mahsulot qadami ko'rsatilmaydi (masalan "boshqa"
 * yo'nalishda keyin ombor o'chirilgan bo'lsa).
 */
export function onboardingQadamlar(code: string | null | undefined, omborli: boolean): OnboardingQadam[] {
  const profil = biznesProfil(code);
  const qadamlar = profil?.onboarding ?? BIZNES_PROFILLAR.other.onboarding;
  return qadamlar.filter((q) => omborli || !["mahsulot", "import", "sotuv", "xarid"].includes(q.kalit));
}
