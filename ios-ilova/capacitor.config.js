/**
 * Balansa iOS ilovasi — Capacitor konfiguratsiyasi.
 *
 * Ilova veb-ilovani (Next.js, balansa.uz) WKWebView ichida ochadi, lekin
 * qobiq NATIVE: Face ID qulfi, haptika, native ulashish, lokal eslatmalar,
 * fayllarni "Files" ilovasiga saqlash. Shu sabab App Store 4.2 (Minimum
 * Functionality) qoidasiga tushmaydi — batafsal: docs/IOS-APP-STORE.md.
 *
 * `BALANSA_URL` env orqali test serverga (masalan Vercel preview) yo'naltirish
 * mumkin; berilmasa production domeni ishlatiladi.
 */

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "uz.balansa.app",
  appName: "Balansa",
  // Lokal fayllar: faqat ulanish uzilganda ko'rsatiladigan sahifa turadi.
  webDir: "www",

  server: {
    // ATAYLAB "/app": bosh sahifa — marketing sahifasi, unda tarif narxlari va
    // to'lov yo'nalishi bor. App Store 3.1.1 bo'yicha ilova ichida raqamli
    // obunaning tashqi to'lovi ko'rsatilmasligi kerak. Ilova to'g'ridan-to'g'ri
    // ish ekranini ochadi; kirmagan foydalanuvchi /login ga yo'naltiriladi.
    url: (process.env.BALANSA_URL || "https://balansa.uz") + "/app",
    // Sayt ochilmasa (internet yo'q) — WKWebView shu lokal sahifani ko'rsatadi,
    // oq ekran qolmaydi. Apple tekshiruvida oq ekran = rad javob.
    errorPath: "oflayn.html",
    // Ilova ichida faqat o'z domenimiz ochiladi. Tashqi havolalar (Telegram,
    // yordam) native brauzerga (SFSafariViewController) uzatiladi.
    allowNavigation: ["balansa.uz", "*.balansa.uz"],
  },

  ios: {
    // Kontent xavfsiz zonaga (notch/Dynamic Island) urilmasin.
    contentInset: "always",
    scrollEnabled: true,
    backgroundColor: "#ffffffff",
    // WKWebView User-Agent oxiriga qo'shiladi — veb tomon "men iOS ilova
    // ichidaman" deb ANIQ bilishi uchun (to'lov UI berkitiladi, App Store 3.1.1).
    appendUserAgent: "BalansaIOS",
  },

  plugins: {
    SplashScreen: {
      // ATAYLAB avtomatik yopiladi: veb yuklanmay qolsa ham ilova qotib
      // qolmasin. Veb tomon tayyor bo'lsa undan oldinroq o'zi yopadi.
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0F766EFF",
      showSpinner: false,
      iosSpinnerStyle: "small",
      splashFullScreen: false,
      splashImmersive: false,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#0F766E",
    },
  },
};

module.exports = config;
