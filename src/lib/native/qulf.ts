/**
 * Ilova qulfi (Face ID / Touch ID) — sozlamalari.
 *
 * Qulf holati NATIVE xotirada (Capacitor Preferences) saqlanadi, localStorage'da
 * emas: WKWebView keshi tozalansa ham qulf yoqilgan bo'lib qolishi kerak.
 * Bu QURILMA darajasidagi himoya — server sessiyasiga aloqasi yo'q, shuning
 * uchun bir foydalanuvchi ikkita telefonda turlicha sozlashi mumkin.
 */

import { biometrikaHolati, biometrikaSora, xotiraOchir, xotiraOqi, xotiraYoz } from "./kopruk";

export { biometrikaHolati, biometrikaSora, iosIlovaMi, xotiraOchir, xotiraOqi } from "./kopruk";
export type { BiometrikaHolati, BiometrikaNatija, BiometrikaTuri } from "./kopruk";

export const QULF_KALIT = "ilova_qulfi";

/** Qulf yoqilganmi. */
export async function qulfYoqilganmi(): Promise<boolean> {
  return (await xotiraOqi(QULF_KALIT)) === "ha";
}

/**
 * Qulfni yoqadi. Yoqishdan OLDIN biometrika so'raladi — foydalanuvchi
 * Face ID ishlashiga ishonch hosil qilmasdan o'zini ilovadan qulflab
 * qo'ymasligi uchun. Tasdiqlanmasa qulf yoqilmaydi.
 */
export async function qulfYoq(): Promise<boolean> {
  const natija = await biometrikaSora("Ilova qulfini yoqish");
  if (natija !== "ok") return false;
  await xotiraYoz(QULF_KALIT, "ha");
  return true;
}

/** Qulfni o'chiradi (bu ham biometrika bilan tasdiqlanadi). */
export async function qulfOchir(): Promise<boolean> {
  const natija = await biometrikaSora("Ilova qulfini o'chirish");
  // "imkonsiz" — Face ID endi ishlamayapti; bunday holatda o'chirishga
  // TO'SQINLIK QILMAYMIZ, aks holda qulf abadiy qolib ketadi.
  if (natija === "bekor") return false;
  await xotiraOchir(QULF_KALIT);
  return true;
}

/** Sozlamalar sahifasi uchun: qurilma nima qo'llab-quvvatlaydi + hozirgi holat. */
export async function qulfSozlamasi(): Promise<{
  mavjud: boolean;
  turi: string;
  yoqilgan: boolean;
}> {
  const [holat, yoqilgan] = await Promise.all([biometrikaHolati(), qulfYoqilganmi()]);
  const nomlar: Record<string, string> = {
    faceid: "Face ID",
    touchid: "Touch ID",
    opticid: "Optic ID",
    yoq: "Biometrika",
  };
  return { mavjud: holat.bor, turi: nomlar[holat.turi] ?? "Biometrika", yoqilgan };
}
