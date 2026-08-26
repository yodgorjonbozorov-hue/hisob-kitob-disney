/**
 * YAGONA OMMAVIY NARX KONFIGURATSIYASI — /tariflar sahifasi va ro'yxatdan
 * o'tish oqimining bitta haqiqat manbai.
 *
 * MUHIM CHEGARA: bu fayl MARKETING va ONBOARDING narxlari uchun. Amaldagi
 * obuna-to'lov tizimi (lib/billing/plans.ts, Payme/Click) alohida ishlaydi va
 * bu fayl uni O'ZGARTIRMAYDI. Yangi "asos + filial + modul" modeli bo'yicha
 * haqiqiy pul olish billing integratsiyasiga ulanmagan — hisob-kitob faqat
 * ko'rsatish va sinovga yozilish uchun (PROGRESS-AGENT.md da hujjatlangan).
 *
 * Client va server ikkalasida ishlatiladi — server-only import qo'shilmasin.
 * Pul har doim so'm, Int (loyiha qoidasi).
 */

/** Qo'shimcha modul (addon) kaliti — URL va konfiguratsiyada ishlatiladi. */
export type AddonKey = "telegram" | "crm" | "pos" | "omborPlus" | "ai";

export interface AddonTarif {
  /** Ko'rsatiladigan nom. */
  nomi: string;
  /** Oylik narx (so'm). */
  oylikNarx: number;
  /** Qisqa tavsif — kalkulyator kartasida ko'rinadi. */
  tavsif: string;
  /**
   * Tizimdagi modul kodi (lib/modules/registry.ts). null — modul emas,
   * tenant-darajali imkoniyat (masalan Telegram bot).
   */
  modulKodi: string | null;
}

export const TRIAL_KUNLARI = 14;

export const pricingConfig = {
  /** Bepul sinov muddati (kun) — lib/services/signup.ts bilan bir xil qiymat. */
  trialDays: TRIAL_KUNLARI,
  /** Balansa asosiy tizimi — oylik narx (so'm). */
  baseMonthlyPrice: 399_000,
  /** Asosiy narxga kiritilgan filiallar soni. */
  includedBranches: 1,
  /** Har qo'shimcha filial uchun oylik narx (so'm). */
  additionalBranchPrice: 149_000,
  /** Yillik to'lovda necha oy bepul ("2 oy bepul" taklifi). */
  yearlyFreeMonths: 2,
  /** Filial slayderining yuqori chegarasi. */
  maxBranches: 15,
  addons: {
    telegram: {
      nomi: "Telegram Hisobot Boti",
      oylikNarx: 79_000,
      tavsif: "Kunlik biznes hisobotlari to'g'ridan-to'g'ri Telegramda.",
      modulKodi: null,
    },
    crm: {
      nomi: "CRM",
      oylikNarx: 99_000,
      tavsif: "Mijozlar, buyurtmalar va bitimlar kanbani.",
      modulKodi: "CRM",
    },
    pos: {
      nomi: "POS / Magazin",
      oylikNarx: 99_000,
      tavsif: "Tez kassa, shtrix-kod bilan sotuv va chek qaytarish.",
      modulKodi: "MAGAZIN",
    },
    omborPlus: {
      nomi: "Kengaytirilgan Ombor",
      oylikNarx: 79_000,
      tavsif: "Rejali xarid buyurtmalari va qabul qilish nazorati.",
      modulKodi: "XARID",
    },
    ai: {
      nomi: "AI Analitika",
      oylikNarx: 99_000,
      tavsif: "Biznes raqamlaringiz bo'yicha avtomatik tahlil va xulosalar.",
      modulKodi: "AI",
    },
  } satisfies Record<AddonKey, AddonTarif>,
} as const;

/** Asosiy tizimga KIRITILGAN imkoniyatlar — tariflar sahifasida ko'rsatiladi. */
export const ASOSIY_IMKONIYATLAR: string[] = [
  "Kirim-chiqim",
  "Kassa",
  "Qarzdorlik",
  "Asosiy ombor",
  "Xodimlar va rollar",
  "Foyda va zarar hisoboti (P&L)",
  "Pul oqimi (Cash Flow)",
  "Excel import",
];

export const ADDON_KEYS: AddonKey[] = ["telegram", "crm", "pos", "omborPlus", "ai"];

export function isAddonKey(v: unknown): v is AddonKey {
  return typeof v === "string" && (ADDON_KEYS as string[]).includes(v);
}

export type TolovDavri = "oylik" | "yillik";

export interface NarxTanlov {
  /** Filiallar soni (kamida 1). */
  filiallar: number;
  /** Tanlangan qo'shimcha modullar. */
  addons: AddonKey[];
  davr: TolovDavri;
}

export interface NarxNatija {
  /** Bir oylik jami (asos + filiallar + modullar), so'm. */
  oylikJami: number;
  /** Yillik to'lovda to'lanadigan summa (bepul oylar chegirilgan), so'm. */
  yillikJami: number;
  /** Yillik to'lovda tejaladigan summa, so'm. */
  yillikTejov: number;
  /** Tanlangan davr bo'yicha to'lanadigan summa, so'm. */
  jami: number;
  /** Qo'shimcha filiallar soni (kiritilganidan tashqari). */
  qoshimchaFiliallar: number;
}

/** Filial sonini xavfsiz chegaraga keltiradi (yaroqsiz qiymat — 1). */
export function normalizeFiliallar(v: unknown): number {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), pricingConfig.maxBranches);
}

/**
 * YAGONA narx hisoblash funksiyasi. Barcha ko'rsatiladigan summalar shu
 * yerdan chiqadi — komponentlarda qo'lda arifmetika qilinmaydi.
 */
export function narxHisobla(tanlov: NarxTanlov): NarxNatija {
  const filiallar = normalizeFiliallar(tanlov.filiallar);
  const qoshimchaFiliallar = Math.max(0, filiallar - pricingConfig.includedBranches);
  const addonlar = tanlov.addons.filter(isAddonKey);
  const addonSumma = addonlar.reduce((s, k) => s + pricingConfig.addons[k].oylikNarx, 0);
  const oylikJami =
    pricingConfig.baseMonthlyPrice +
    qoshimchaFiliallar * pricingConfig.additionalBranchPrice +
    addonSumma;
  const yillikJami = oylikJami * (12 - pricingConfig.yearlyFreeMonths);
  const yillikTejov = oylikJami * 12 - yillikJami;
  return {
    oylikJami,
    yillikJami,
    yillikTejov,
    jami: tanlov.davr === "yillik" ? yillikJami : oylikJami,
    qoshimchaFiliallar,
  };
}

/**
 * So'm summani "399 000" ko'rinishida formatlaydi — loyihaning yagona
 * guruhlash uslubi (lib/format.formatSom) qayta eksport qilinadi, sayt va
 * kalkulyator bir xil raqam yozsin.
 */
export { formatSom as somFormat } from "@/lib/format";
