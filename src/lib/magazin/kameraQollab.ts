/**
 * KAMERA SKANERI QO'LLAB-QUVVATLANADIMI.
 *
 * Kamera orqali kod o'qish brauzerning o'z `BarcodeDetector` API'siga
 * tayanadi. U hamma joyda YO'Q:
 *
 *   Android Chrome, ChromeOS, ish stolidagi Chrome/Edge — BOR;
 *   iOS Safari (va iOS'dagi BARCHA brauzerlar, chunki ular ham WebKit),
 *   Firefox — YO'Q.
 *
 * NEGA DEKODER KUTUBXONASI QO'SHILMADI (ochiq qaror):
 *
 *   `@zxing/library`  — 11.8 MB paket (bundle'da ~300 KB gz);
 *   `html5-qrcode`    — 2.6 MB, ichida o'sha zxing;
 *   `jsQR`            — 280 KB, LEKIN faqat QR o'qiydi — quti ustidagi
 *                       EAN-13 shtrix-kodini umuman tanimaydi.
 *
 * Kassa ekrani — ilovadagi eng tez ochilishi kerak bo'lgan sahifa. Uning
 * bundle'iga yuzlab kilobayt qo'shish HAR bir kassirning har kunini
 * sekinlashtiradi, ayni paytda kamera do'konda IKKINCHI DARAJALI kirish
 * yo'li: asosiy qurol — apparat skaner (USB yoki Bluetooth), u iOS'da ham
 * oddiy klaviatura sifatida ishlaydi va hech qanday API talab qilmaydi.
 *
 * Shu bois qo'llab-quvvatlanmaydigan brauzerda kamera o'rniga ANIQ
 * ko'rsatma beriladi va foydalanuvchi qidiruvga qaytariladi — bu yo'l
 * har doim ishlaydi.
 */

export type KameraHolati =
  | { qollab: true }
  | { qollab: false; sabab: string };

/** Brauzerdagi `BarcodeDetector` — TypeScript tiplarida hali yo'q. */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
export type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

/**
 * Kamera skaneri shu brauzerda ishlaydimi.
 *
 * `win` parametri test uchun: sof funksiya bo'lgani uchun brauzersiz ham
 * tekshirib ko'rish mumkin.
 */
export function kameraHolati(win: unknown = typeof window === "undefined" ? undefined : window): KameraHolati {
  const w = win as
    | { BarcodeDetector?: unknown; navigator?: { mediaDevices?: { getUserMedia?: unknown } } }
    | undefined;

  if (!w) {
    return { qollab: false, sabab: "Brauzer muhiti topilmadi." };
  }
  if (typeof w.BarcodeDetector !== "function") {
    return {
      qollab: false,
      // iPhone/iPad eng ko'p uchraydigan holat — nomi bilan aytiladi,
      // aks holda foydalanuvchi "buzilibdi" deb o'ylaydi.
      sabab:
        "Bu brauzer (masalan iPhone Safari) kamera orqali kod o'qishni qo'llab-quvvatlamaydi.",
    };
  }
  if (typeof w.navigator?.mediaDevices?.getUserMedia !== "function") {
    return { qollab: false, sabab: "Bu sahifada kameraga kirishga ruxsat yo'q." };
  }
  return { qollab: true };
}

/**
 * Qo'llab-quvvatlanmaganda ko'rsatiladigan YO'L-YO'RIQ.
 *
 * Ataylab ikki aniq harakat: skaner ulash yoki qidiruvdan foydalanish.
 * Ikkalasi ham HAR brauzerda ishlaydi.
 */
export const KAMERASIZ_YORIQNOMA = [
  "Shtrix-kod skanerini ulang — u klaviatura kabi ishlaydi va bu brauzerda ham to'liq ishlaydi.",
  "Yoki qidiruv maydoniga tovar nomini yoki kod raqamini yozing.",
] as const;
