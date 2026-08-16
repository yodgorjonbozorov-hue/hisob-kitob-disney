/**
 * Native ko'prik — Balansa iOS ilovasi (Capacitor) bilan aloqa.
 *
 * ATAYLAB PAKETSIZ: `@capacitor/*` npm paketlari veb ilovaga QO'SHILMAYDI.
 * Capacitor WKWebView ichiga `window.Capacitor` obyektini o'zi joylaydi va
 * unda `nativePromise(plagin, metod, sozlama)` mavjud — plagin JS paketlari
 * faqat shu chaqiruvning tipli o'ramchisi. Biz o'ramchini o'zimiz yozamiz:
 *
 *   - veb ilova bog'liqliklari o'zgarmaydi (bundle kattalashmaydi);
 *   - brauzerda (PWA) hech narsa buzilmaydi — har chaqiruv `null` qaytaradi;
 *   - SSR paytida `window` yo'q, shuning uchun hamma joyda tekshiriladi.
 *
 * Plagin nomlari native tomondagi `jsName` bilan bir xil bo'lishi SHART —
 * manba: ios-ilova ichidagi Capacitor plaginlarining Swift fayllari.
 */

/** Native tomonga uzatiladigan JSON qiymat (any ishlatilmaydi). */
type Qiymat = string | number | boolean | null | Qiymat[] | { [kalit: string]: Qiymat };
type Sozlama = Record<string, Qiymat | undefined>;

interface CapacitorOyna {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  nativePromise?: (plagin: string, metod: string, sozlama?: Sozlama) => Promise<unknown>;
}

function cap(): CapacitorOyna | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { Capacitor?: CapacitorOyna };
  return w.Capacitor ?? null;
}

/** "ios" | "android" | "web". Brauzerda doim "web". */
export function platforma(): string {
  return cap()?.getPlatform?.() ?? "web";
}

/** Balansa native ilovasi ichidamizmi? */
export function nativeMi(): boolean {
  return cap()?.isNativePlatform?.() === true;
}

/** Aynan iOS ilovasi ichidamizmi (App Store qoidalari shunga bog'liq). */
export function iosIlovaMi(): boolean {
  return nativeMi() && platforma() === "ios";
}

/**
 * Native plaginni chaqiradi. Brauzerda yoki xatolikda `null` qaytadi —
 * chaqiruvchi tomon hech qachon yiqilmaydi (native imkoniyat ixtiyoriy).
 */
export async function chaqir<T>(plagin: string, metod: string, sozlama?: Sozlama): Promise<T | null> {
  const c = cap();
  if (!c?.nativePromise) return null;
  try {
    return (await c.nativePromise(plagin, metod, sozlama)) as T;
  } catch {
    // Foydalanuvchi bekor qilgan yoki plagin yo'q — jim o'tamiz.
    return null;
  }
}

/**
 * `chaqir` dan farqi: xatoni YUTMAYDI. Biometrikada "bekor qildi" bilan
 * "qurilma qo'llab-quvvatlamaydi" ni ajratish kerak.
 */
export async function chaqirXatoBilan<T>(
  plagin: string,
  metod: string,
  sozlama?: Sozlama,
): Promise<T> {
  const c = cap();
  if (!c?.nativePromise) throw new Error("native-emas");
  return (await c.nativePromise(plagin, metod, sozlama)) as T;
}

// ─────────────────────────── Haptika ───────────────────────────

type HaptikaTuri = "yengil" | "orta" | "kuchli" | "muvaffaqiyat" | "ogohlantirish" | "xato";

/**
 * Tebranishli javob — pul kiritildi, kassa topshirildi kabi muhim amallarda.
 * Brauzerda hech narsa qilmaydi.
 */
export function haptika(tur: HaptikaTuri = "yengil"): void {
  const zarba: Record<string, string> = { yengil: "LIGHT", orta: "MEDIUM", kuchli: "HEAVY" };
  const xabar: Record<string, string> = {
    muvaffaqiyat: "SUCCESS",
    ogohlantirish: "WARNING",
    xato: "ERROR",
  };
  if (zarba[tur]) void chaqir("Haptics", "impact", { style: zarba[tur] });
  else if (xabar[tur]) void chaqir("Haptics", "notification", { type: xabar[tur] });
}

// ─────────────────────── Ekran / ko'rinish ───────────────────────

/** Splash ekranini yopadi (veb tayyor bo'lgach darhol chaqiriladi). */
export function splashYop(): void {
  void chaqir("SplashScreen", "hide", { fadeOutDuration: 200 });
}

/**
 * Status bar matni rangi. `qorongu=true` bo'lsa fon qorong'i → matn OQ.
 * Capacitor'da "DARK" = oq matn (chalkash, shuning uchun shu yerda o'raladi).
 */
export function statusBarSozla(qorongu: boolean): void {
  void chaqir("StatusBar", "setStyle", { style: qorongu ? "DARK" : "LIGHT" });
}

/**
 * Tashqi havolani ilova ICHIDAGI brauzerda ochadi (SFSafariViewController).
 * WKWebView ichida ochilsa foydalanuvchi ilovadan chiqib ketolmay qoladi.
 * Native bo'lmasa `false` qaytaradi — chaqiruvchi oddiy havolaga tayanadi.
 */
export async function tashqaridaOch(url: string): Promise<boolean> {
  const natija = await chaqir("Browser", "open", { url, presentationStyle: "popover" });
  return natija !== null;
}

// ──────────────────────── Fayl / ulashish ────────────────────────

/**
 * Hisobot faylini (PDF/Excel) telefonga saqlaydi va native "Ulashish"
 * oynasini ochadi — u yerdan Files, Telegram, pochta va h.k.
 *
 * Fayl KESH papkasiga yoziladi: iOS uni o'zi tozalaydi, zaxira nusxaga
 * tushmaydi. `base64` — faylning xom mazmuni.
 */
export async function faylUlash(nom: string, base64: string, sarlavha?: string): Promise<boolean> {
  const yozildi = await chaqir<{ uri: string }>("Filesystem", "writeFile", {
    path: nom,
    data: base64,
    directory: "CACHE",
  });
  if (!yozildi?.uri) return false;
  const ulashildi = await chaqir("Share", "share", {
    title: sarlavha ?? nom,
    files: [yozildi.uri],
    dialogTitle: "Hisobotni saqlash",
  });
  return ulashildi !== null;
}

// ───────────────────────── Biometrika ─────────────────────────

/** LABiometryType: 0 — yo'q, 1 — Touch ID, 2 — Face ID, 4 — Optic ID. */
export type BiometrikaTuri = "yoq" | "touchid" | "faceid" | "opticid";

export interface BiometrikaHolati {
  bor: boolean;
  turi: BiometrikaTuri;
  /** Qurilmada parol/PIN o'rnatilganmi (biometrika o'chirilgan bo'lsa ham). */
  qurilmaHimoyalangan: boolean;
}

const TURLAR: Record<number, BiometrikaTuri> = {
  0: "yoq",
  1: "touchid",
  2: "faceid",
  4: "opticid",
};

/** Qurilmada Face ID / Touch ID bormi. */
export async function biometrikaHolati(): Promise<BiometrikaHolati> {
  const j = await chaqir<{
    isAvailable: boolean;
    biometryType: number;
    deviceIsSecure: boolean;
  }>("BiometricAuthNative", "checkBiometry");
  if (!j) return { bor: false, turi: "yoq", qurilmaHimoyalangan: false };
  return {
    bor: j.isAvailable === true,
    turi: TURLAR[j.biometryType] ?? "yoq",
    qurilmaHimoyalangan: j.deviceIsSecure === true,
  };
}

export type BiometrikaNatija = "ok" | "bekor" | "imkonsiz";

/**
 * Face ID / Touch ID so'raydi.
 * `bekor` — foydalanuvchi rad etdi (qayta so'rash mumkin),
 * `imkonsiz` — qurilmada yo'q yoki bloklangan (qulfni o'chirish kerak).
 */
export async function biometrikaSora(sabab: string): Promise<BiometrikaNatija> {
  try {
    await chaqirXatoBilan("BiometricAuthNative", "internalAuthenticate", {
      reason: sabab,
      cancelTitle: "Bekor qilish",
      iosFallbackTitle: "Qurilma parolini kiritish",
      // Face ID ishlamasa (masalan niqob) qurilma paroli bilan kirish mumkin.
      allowDeviceCredential: true,
    });
    return "ok";
  } catch (xato) {
    const kod = (xato as { code?: string })?.code ?? "";
    if (kod === "biometryNotAvailable" || kod === "biometryNotEnrolled" || kod === "passcodeNotSet") {
      return "imkonsiz";
    }
    return "bekor";
  }
}

// ──────────────────── Qurilma xotirasi (Preferences) ────────────────────

/**
 * Native xotira. localStorage'dan farqi: ilova o'chirilmaguncha saqlanadi va
 * WKWebView keshi tozalanganda YO'QOLMAYDI — qulf sozlamasi shu yerda turadi.
 */
export async function xotiraOqi(kalit: string): Promise<string | null> {
  const j = await chaqir<{ value: string | null }>("Preferences", "get", { key: kalit });
  return j?.value ?? null;
}

export async function xotiraYoz(kalit: string, qiymat: string): Promise<void> {
  await chaqir("Preferences", "set", { key: kalit, value: qiymat });
}

export async function xotiraOchir(kalit: string): Promise<void> {
  await chaqir("Preferences", "remove", { key: kalit });
}
