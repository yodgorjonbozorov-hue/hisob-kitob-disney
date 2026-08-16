import { headers } from "next/headers";

/**
 * So'rov Balansa iOS ilovasi ichidan kelganmi (server tomonda aniqlash).
 *
 * Capacitor WKWebView User-Agent oxiriga "BalansaIOS" qo'shadi
 * (ios-ilova/capacitor.config.js → ios.appendUserAgent). Bu belgi bizniki —
 * Safari yoki boshqa brauzerda hech qachon uchramaydi.
 *
 * NEGA KERAK: App Store 3.1.1 qoidasiga ko'ra ilova ichida raqamli obunani
 * ILOVADAN TASHQARI to'lash havolasi ko'rsatilmaydi (Payme/Click). Sahifa
 * serverda render bo'lgani uchun tekshiruv ham serverda bo'lishi shart —
 * aks holda to'lov tugmasi bir lahza ko'rinib ketadi.
 *
 * Klient tomonda ekvivalenti: `iosIlovaMi()` (lib/native/kopruk.ts).
 */
export function iosIlovadanMi(): boolean {
  return (headers().get("user-agent") ?? "").includes("BalansaIOS");
}
