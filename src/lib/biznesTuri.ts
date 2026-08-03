/**
 * BIZNES TURI va unga bog'liq UI matnlari.
 *
 * Ombor moduli ikki rejimda ishlaydi:
 *  - "umumiy" — klassik ombor: bitta mahsulot turi, ko'p dona qoldiq;
 *  - "avto"   — olib-sotar: bitta yozuv = bitta avtomobil (qoldiq 0 yoki 1),
 *               tannarx = mashina olingan narx, sotuvda sof foyda ko'rinadi.
 *
 * Faqat matn va sotuv qoidalari farq qiladi — jadvallar va hisob mantiqi bir xil.
 * Client va server ikkalasida ishlatiladi — server-only import qo'shilmasin.
 */

export type BiznesTuri = "umumiy" | "avto";

export const BIZNES_TURLARI: { code: BiznesTuri; nomi: string; tavsif: string }[] = [
  { code: "umumiy", nomi: "Umumiy", tavsif: "Tovar sotadigan biznes — ombor qoldig'i dona bilan yuritiladi." },
  { code: "avto", nomi: "Avto (olib-sotar)", tavsif: "Har bir mashina alohida yuritiladi: olingan narx, sotilgan narx, sof foyda." },
];

export function isAvto(turi: string | null | undefined): boolean {
  return turi === "avto";
}

export interface OmborMatn {
  /** Sahifa sarlavhasi va nav yorlig'i. */
  modul: string;
  /** Bitta birlik nomi ("mahsulot" / "mashina"). */
  birlik: string;
  birlikBosh: string;
  /** Dona o'lchovi ("dona" / "ta"). */
  dona: string;
  turlarSoni: string;
  jamiQoldiq: string;
  omborQiymati: string;
  yangi: string;
  koproq: string;
  nomiPlaceholder: string;
  tannarx: string;
  sotuvNarx: string;
  qoldiq: string;
  kirim: string;
  bosh: string;
  foydaSarlavha: string;
  sotilgan: string;
}

const UMUMIY: OmborMatn = {
  modul: "Ombor",
  birlik: "mahsulot",
  birlikBosh: "Mahsulot",
  dona: "dona",
  turlarSoni: "Mahsulot turlari",
  jamiQoldiq: "Jami qoldiq (dona)",
  omborQiymati: "Ombor qiymati (tannarx)",
  yangi: "+ Yangi mahsulot",
  koproq: "Ko'p tur qo'shish",
  nomiPlaceholder: "Nomi (masalan: Mikki)",
  tannarx: "Kelgan narx (tannarx)",
  sotuvNarx: "Sotuv narxi",
  qoldiq: "Qoldiq",
  kirim: "Ombor kirimi",
  bosh: "Hali mahsulot yo'q",
  foydaSarlavha: "Mahsulot foydaliligi",
  sotilgan: "Sotilgan",
};

const AVTO: OmborMatn = {
  modul: "Avtopark",
  birlik: "mashina",
  birlikBosh: "Mashina",
  dona: "ta",
  turlarSoni: "Avtoparkdagi mashinalar",
  jamiQoldiq: "Sotuvda turibdi",
  omborQiymati: "Avtopark qiymati (olingan narx)",
  yangi: "+ Mashina qo'shish",
  koproq: "Ko'p mashina qo'shish",
  nomiPlaceholder: "Model (masalan: Malibu 2)",
  tannarx: "Olingan narx",
  sotuvNarx: "Sotuv narxi",
  qoldiq: "Holati",
  kirim: "Avtoparkka qaytarish",
  bosh: "Avtoparkda mashina yo'q",
  foydaSarlavha: "Sotilgan mashinalar bo'yicha sof foyda",
  sotilgan: "Sotildi",
};

export function omborMatn(turi: string | null | undefined): OmborMatn {
  return isAvto(turi) ? AVTO : UMUMIY;
}

// ---------------------------------------------------------------------------
// Qarzdorlik yo'nalishlari — biznes turidan qat'i nazar bir xil.
// ---------------------------------------------------------------------------

export type QarzTuri = "olinadigan" | "beriladigan";

export interface QarzMatn {
  /** Ro'yxat sarlavhasi. */
  nomi: string;
  /** Qisqa izoh. */
  tavsif: string;
  /** Qarz egasining roli ("Mijoz" / "Kimga"). */
  tomon: string;
  /** To'lov amali nomi. */
  tolov: string;
}

export const QARZ_MATN: Record<QarzTuri, QarzMatn> = {
  olinadigan: {
    nomi: "Menga qarzdor",
    tavsif: "Qarzga sotilgan — pul kelishi kerak",
    tomon: "Mijoz",
    tolov: "To'lov qabul qilish",
  },
  beriladigan: {
    nomi: "Men qarzdorman",
    tavsif: "Olingan mol/mashina uchun to'lanmagan pul",
    tomon: "Kimga",
    tolov: "To'lash",
  },
};

export function isQarzTuri(v: unknown): v is QarzTuri {
  return v === "olinadigan" || v === "beriladigan";
}
