import type { ShaxsTuri } from "./shaxs";

/**
 * PUL OLDIM / PUL BERDIM SABABLARI.
 *
 * Sabab — bu KATEGORIYA. Yangi "sabab" jadvali ochilmaydi: kirim/chiqim
 * kategoriyalari (`Category`) allaqachon butun tizimda hisobot kesimi bo'lib
 * ishlaydi (dashboard, budjet, tasdiqlash qoidalari, kategoriya analitikasi).
 * Ikkinchi lug'at ochilsa "Ta'minotchiga to'lov" ikki xil joyda ikki xil
 * jamlanardi.
 *
 * Shuning uchun bu yerdagi ro'yxat — DEFAULT KATEGORIYALAR to'plami: birinchi
 * marta ishlatilganda `ensureCategoryTx` bilan yaratiladi, keyin oddiy
 * kategoriya kabi yashaydi. Direktor `/app/admin/kategoriyalar` da yangi
 * kategoriya qo'shsa — u ham shu formada darhol tanlanadigan bo'ladi.
 *
 * `qarz` bayrog'i — eng muhim qism: shu sabab tanlansa summa QARZGA
 * yoziladi (mavjud `qarzdorTolov` xizmati orqali), aks holda oddiy
 * kirim/chiqim bo'lib qoladi (9-talab: har amal majburiy qarzga bog'lanmaydi).
 *
 * Client va server ikkalasida ishlatiladi — server-only import qo'shilmasin.
 */

export interface Sabab {
  /** Barqaror kod — formadan serverga shu yuboriladi. */
  kod: string;
  /** Kategoriya nomi (bazada shu nom bilan yaratiladi va ko'rinadi). */
  nomi: string;
  /** Shu sabab qarz qoldig'ini kamaytiradimi. */
  qarz: boolean;
  /**
   * Qaysi tomonlarda ko'rsatiladi. Bo'sh — hamma tomonda.
   * Ro'yxat qisqa bo'lsa foydalanuvchi tez tanlaydi (14-talab).
   */
  shaxslar?: ShaxsTuri[];
}

/** "+ Pul oldim" sabablari (kirim kategoriyalari). */
export const KIRIM_SABABLARI: Sabab[] = [
  { kod: "savdo", nomi: "Savdo uchun to'lov", qarz: false, shaxslar: ["mijoz", "shaxs", "boshqa"] },
  { kod: "mijoz-qarz", nomi: "Mijoz qarzini to'ladi", qarz: true, shaxslar: ["mijoz"] },
  { kod: "xodim-qaytardi", nomi: "Xodim pul qaytardi", qarz: true, shaxslar: ["xodim"] },
  { kod: "qarz-oldik", nomi: "Qarz oldik", qarz: false },
  { kod: "shaxsdan", nomi: "Boshqa shaxsdan pul olindi", qarz: false, shaxslar: ["shaxs", "boshqa"] },
  { kod: "filialdan", nomi: "Filialdan pul olindi", qarz: false, shaxslar: ["filial"] },
  { kod: "qaytim", nomi: "Qaytim", qarz: false },
  { kod: "boshqa-kirim", nomi: "Boshqa kirim", qarz: false },
];

/** "− Pul berdim" sabablari (chiqim kategoriyalari). */
export const CHIQIM_SABABLARI: Sabab[] = [
  { kod: "taminotchi-tolov", nomi: "Ta'minotchiga pul berish", qarz: false, shaxslar: ["taminotchi"] },
  { kod: "taminotchi-qarz", nomi: "Ta'minotchi qarzini to'lash", qarz: true, shaxslar: ["taminotchi"] },
  { kod: "xodimga", nomi: "Xodimga pul berildi", qarz: false, shaxslar: ["xodim"] },
  { kod: "avans", nomi: "Avans", qarz: false, shaxslar: ["xodim"] },
  { kod: "xarajat", nomi: "Xarajat", qarz: false },
  { kod: "qarz-berdik", nomi: "Qarz berdik", qarz: false },
  { kod: "filialga", nomi: "Filialga pul berildi", qarz: false, shaxslar: ["filial"] },
  { kod: "mijozga-qaytim", nomi: "Mijozga qaytim", qarz: false, shaxslar: ["mijoz"] },
  { kod: "mijoz-qarz-tolash", nomi: "Mijoz qarzini yopish", qarz: true, shaxslar: ["mijoz"] },
  { kod: "boshqa-chiqim", nomi: "Boshqa chiqim", qarz: false },
];

export function sabablar(yonalish: "kirim" | "chiqim"): Sabab[] {
  return yonalish === "kirim" ? KIRIM_SABABLARI : CHIQIM_SABABLARI;
}

/**
 * QAT'IY TOMONLAR — ro'yxatda FAQAT shu yerda sanab o'tilgan sabablar
 * qoladi; boshqasining hammasi (umumiy sabablar ham, direktor qo'shgan
 * kategoriyalar ham) YASHIRILADI.
 *
 * TA'MINOTCHIDA BITTA VARIANT: "Ta'minotchiga pul berish". Ta'minotchiga
 * pul berish — bitta amal, uni "Xarajat" yoki "Boshqa chiqim" ga yozib
 * yuborish ta'minotchi kesimidagi hisobotni yolg'onga aylantirardi,
 * ikkinchi variant esa kassirni har safar "qaysi birini tanlayman?"
 * degan ikkilanishga solardi.
 *
 * QARZ TO'LOVI BU RO'YXATDAN CHIQARILDI: ta'minotchi qarzini yopish
 * QARZLAR bo'limidan bajariladi — u yerda qaysi qarzga, qancha va qanday
 * taqsimlanishi ko'rinib turadi. Sabab katalogda QOLADI (o'chirilmaydi):
 * eski yozuvlar tahrirlanganda ular o'z sababini yo'qotmasligi kerak.
 *
 * Boshqa tomonlarda (mijoz, xodim, filial) umumiy sabablar ATAYLAB
 * qoladi: u yerda "Xarajat" yoki "Qaytim" haqiqatan ham uchraydi.
 */
const QATIY_SHAXSLAR: Partial<Record<ShaxsTuri, string[]>> = {
  taminotchi: ["taminotchi-tolov"],
};

export function qatiyShaxsmi(shaxsTuri: ShaxsTuri): boolean {
  return QATIY_SHAXSLAR[shaxsTuri] !== undefined;
}

/** Tomonga mos sabablar — ro'yxat qisqarsa tanlash tezlashadi. */
export function shaxsSabablari(yonalish: "kirim" | "chiqim", shaxsTuri: ShaxsTuri): Sabab[] {
  const qatiy = QATIY_SHAXSLAR[shaxsTuri];
  if (qatiy) return sabablar(yonalish).filter((s) => qatiy.includes(s.kod));
  return sabablar(yonalish).filter((s) => !s.shaxslar || s.shaxslar.includes(shaxsTuri));
}

export function sababTop(yonalish: "kirim" | "chiqim", kod: string): Sabab | null {
  return sabablar(yonalish).find((s) => s.kod === kod) ?? null;
}
