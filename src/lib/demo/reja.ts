/**
 * DEMO MA'LUMOT REJASI — SOF hisob (bazaga bog'liq emas).
 *
 * Nega alohida fayl: demo raqamlari BIR-BIRIGA MOS bo'lishi shart —
 * ombor qoldig'i = kirgan − sotilgan, qarz = sotuv summasi − to'langan,
 * sof foyda = kirim − chiqim. Agar bu hisob bazaga yozish kodi bilan
 * aralashib ketsa, xatoni ko'rish imkonsiz bo'lardi. Endi reja sof
 * funksiyalar bilan tuziladi va `tests/demo.test.ts` uni bazasiz tekshiradi.
 *
 * Sanalar NISBIY (bugundan orqaga) — demo hech qachon eskirmaydi.
 * Pul har doim `Int` (so'm).
 */

/** Demo tarixi necha kun (bugun ham kiradi). */
export const DEMO_KUNLAR = 40;

/**
 * Barqaror tasodif (mulberry32). `Math.random` ishlatilmaydi: har ekishda
 * boshqa raqam chiqsa, demo skrinshotlari va testlar beqaror bo'lardi.
 */
function tasodif(urugh: number): () => number {
  let a = urugh >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoMahsulot {
  kod: string;
  nomi: string;
  birlik: string;
  kelganNarx: number;
  sotuvNarx: number;
  /** Davr oxirida ombor qoldig'i shu songa TENG bo'lishi kerak. */
  qoldiq: number;
  minQoldiq: number;
}

export interface DemoMijoz {
  kod: string;
  ism: string;
  tel: string;
  manzil: string;
}

export interface DemoXodim {
  ism: string;
  lavozim: string;
  /** Oylik stavka (so'm). */
  stavka: number;
}

export interface DemoSotuv {
  /** Bugundan necha kun oldin (0 — bugun). */
  kunOldin: number;
  mahsulotKod: string;
  miqdor: number;
  tolovTuri: "naqd" | "qarz";
  /** Naqd sotuvda pul qaysi kassaga tushdi. */
  kassa: "naqd" | "plastik";
  mijozKod: string;
}

export interface DemoChiqim {
  kunOldin: number;
  kategoriya: string;
  summa: number;
  izoh: string;
  kassa: "naqd" | "plastik";
}

export interface DemoQarzTolov {
  /** `sotuvlar` massividagi qarz sotuvining indeksi. */
  sotuvIndex: number;
  kunOldin: number;
  summa: number;
}

/** Terminaldan kassaga pul yechish (kassalararo o'tkazma). */
export interface DemoOtkazma {
  kunOldin: number;
  summa: number;
}

export interface DemoZakaz {
  nomi: string;
  mijozKod: string;
  summa: number;
  bosqich: string;
  kunOldin: number;
}

/** Namunaviy (to'qima) mahsulotlar — optom oziq-ovqat va xo'jalik mollari. */
export const MAHSULOTLAR: DemoMahsulot[] = [
  { kod: "shakar", nomi: "Shakar 50 kg", birlik: "paket", kelganNarx: 610_000, sotuvNarx: 720_000, qoldiq: 24, minQoldiq: 10 },
  { kod: "un", nomi: "Un oliy nav 50 kg", birlik: "paket", kelganNarx: 320_000, sotuvNarx: 385_000, qoldiq: 31, minQoldiq: 12 },
  { kod: "guruch", nomi: "Guruch lazer 25 kg", birlik: "paket", kelganNarx: 480_000, sotuvNarx: 585_000, qoldiq: 18, minQoldiq: 8 },
  { kod: "yog", nomi: "Paxta yog'i 5 l", birlik: "quti", kelganNarx: 95_000, sotuvNarx: 118_000, qoldiq: 46, minQoldiq: 20 },
  { kod: "makaron", nomi: "Makaron 5 kg", birlik: "paket", kelganNarx: 42_000, sotuvNarx: 53_000, qoldiq: 62, minQoldiq: 25 },
  { kod: "choy", nomi: "Ko'k choy 250 g", birlik: "dona", kelganNarx: 18_000, sotuvNarx: 24_000, qoldiq: 140, minQoldiq: 50 },
  { kod: "shokolad", nomi: "Shokolad assorti quti", birlik: "quti", kelganNarx: 65_000, sotuvNarx: 84_000, qoldiq: 35, minQoldiq: 15 },
  { kod: "kukun", nomi: "Kir yuvish kukuni 6 kg", birlik: "dona", kelganNarx: 78_000, sotuvNarx: 96_000, qoldiq: 9, minQoldiq: 15 },
  { kod: "gazak", nomi: "Gazak (chips) quti", birlik: "quti", kelganNarx: 55_000, sotuvNarx: 71_000, qoldiq: 28, minQoldiq: 12 },
  { kod: "suv", nomi: "Mineral suv 12×1,5 l", birlik: "quti", kelganNarx: 26_000, sotuvNarx: 35_000, qoldiq: 74, minQoldiq: 30 },
];

/** To'qima mijozlar — hech bir haqiqiy mijozdan ko'chirilmagan. */
export const MIJOZLAR: DemoMijoz[] = [
  { kod: "m1", ism: "Zafar Aliyev (Do'kon «Baraka»)", tel: "+998901110001", manzil: "Navoiy, Galaba ko'chasi 12" },
  { kod: "m2", ism: "Dilnoza Rahimova (Mini market)", tel: "+998901110002", manzil: "Navoiy, Yoshlik 4" },
  { kod: "m3", ism: "Sardor Yo'ldoshev (Optom baza)", tel: "+998901110003", manzil: "Karmana, Bozor yo'li 8" },
  { kod: "m4", ism: "Nodira Qosimova (Kafe «Lola»)", tel: "+998901110004", manzil: "Navoiy, Islom Karimov 45" },
  { kod: "m5", ism: "Bekzod Ergashev (Savdo nuqtasi)", tel: "+998901110005", manzil: "Zarafshon, Markaziy 3" },
  { kod: "m6", ism: "Malika Tosheva (Do'kon «Hilol»)", tel: "+998901110006", manzil: "Navoiy, Tinchlik 21" },
  { kod: "m7", ism: "Jasur Nazarov (Yetkazib berish)", tel: "+998901110007", manzil: "Navbahor, Sanoat 2" },
  { kod: "m8", ism: "Umida Sattorova (Choyxona)", tel: "+998901110008", manzil: "Navoiy, Bog' ko'chasi 7" },
];

export const XODIMLAR: DemoXodim[] = [
  { ism: "Anvar Xolmatov", lavozim: "Sotuvchi", stavka: 4_500_000 },
  { ism: "Gulnora Ismoilova", lavozim: "Kassir", stavka: 4_000_000 },
  { ism: "Rustam Qodirov", lavozim: "Omborchi", stavka: 4_200_000 },
  { ism: "Shahnoza Yusupova", lavozim: "Buxgalter", stavka: 5_000_000 },
  { ism: "Otabek Nurmatov", lavozim: "Haydovchi", stavka: 3_800_000 },
];

export const ZAKAZ_BOSQICHLARI: { nomi: string; turi: "OPEN" | "WON" | "LOST" }[] = [
  { nomi: "Yangi so'rov", turi: "OPEN" },
  { nomi: "Kelishuv", turi: "OPEN" },
  { nomi: "To'lov kutilmoqda", turi: "OPEN" },
  { nomi: "Yakunlandi", turi: "WON" },
  { nomi: "Yo'qotildi", turi: "LOST" },
];

export const ZAKAZLAR: DemoZakaz[] = [
  { nomi: "Yangi do'kon uchun boshlang'ich partiya", mijozKod: "m1", summa: 12_400_000, bosqich: "Kelishuv", kunOldin: 3 },
  { nomi: "Oylik ta'minot shartnomasi", mijozKod: "m3", summa: 28_000_000, bosqich: "To'lov kutilmoqda", kunOldin: 6 },
  { nomi: "Kafe uchun haftalik yetkazib berish", mijozKod: "m4", summa: 5_600_000, bosqich: "Yangi so'rov", kunOldin: 1 },
  { nomi: "Bayram partiyasi (shokolad, choy)", mijozKod: "m6", summa: 8_900_000, bosqich: "Yakunlandi", kunOldin: 11 },
  { nomi: "Zarafshon filialiga yetkazish", mijozKod: "m5", summa: 15_200_000, bosqich: "Yakunlandi", kunOldin: 18 },
  { nomi: "Katta hajmli guruch buyurtmasi", mijozKod: "m7", summa: 21_000_000, bosqich: "Yo'qotildi", kunOldin: 24 },
];

/** Kirim kategoriyalari — ombor va qarz xizmatlari shu nomlarni ishlatadi. */
export const KIRIM_KATEGORIYALAR = ["Sotuv", "Qarz to'lovi", "Boshqa kirim"];
export const CHIQIM_KATEGORIYALAR = [
  "Tovar xaridi",
  "Ijara",
  "Oyliklar",
  "Kommunal",
  "Transport",
  "Mayda xarajatlar",
];

export interface DemoReja {
  sotuvlar: DemoSotuv[];
  qarzTolovlari: DemoQarzTolov[];
  chiqimlar: DemoChiqim[];
  otkazmalar: DemoOtkazma[];
  /** Mahsulot kodi → omborga kirim partiyalari (kun, miqdor). */
  omborKirimlari: Record<string, { kunOldin: number; miqdor: number }[]>;
}

/**
 * SOTUVLAR. Har kun 1-3 ta; bugungi kunda ANIQ ikkita naqd sotuv bo'ladi —
 * mehmon birinchi ekranda "bugungi savdo" raqamini bo'sh ko'rmasligi kerak.
 */
function sotuvlarniTuz(): DemoSotuv[] {
  const rnd = tasodif(20260907);
  const sotuvlar: DemoSotuv[] = [];
  for (let kun = DEMO_KUNLAR - 1; kun >= 0; kun--) {
    // Kuniga 4-8 savdo; bugun ANIQ 4 ta — mehmon birinchi ekranda
    // "bugungi savdo" raqamini bo'sh ko'rmasligi kerak.
    const soni = kun === 0 ? 4 : 4 + Math.floor(rnd() * 5);
    for (let i = 0; i < soni; i++) {
      const m = MAHSULOTLAR[Math.floor(rnd() * MAHSULOTLAR.length)];
      const mijoz = MIJOZLAR[Math.floor(rnd() * MIJOZLAR.length)];
      // Qarzga savdo — optom biznesning odatiy holati, lekin ozchilik.
      const qarz = kun !== 0 && rnd() < 0.22;
      sotuvlar.push({
        kunOldin: kun,
        mahsulotKod: m.kod,
        miqdor: 3 + Math.floor(rnd() * 12),
        tolovTuri: qarz ? "qarz" : "naqd",
        // Naqd savdoning uchdan biri terminal orqali o'tadi.
        kassa: rnd() < 0.34 ? "plastik" : "naqd",
        mijozKod: mijoz.kod,
      });
    }
  }
  return sotuvlar;
}

/** Qarzlarning bir qismi qisman/to'liq to'langan — qarzdorlik ekrani jonli bo'lsin. */
function qarzTolovlariniTuz(sotuvlar: DemoSotuv[]): DemoQarzTolov[] {
  const rnd = tasodif(778899);
  const tolovlar: DemoQarzTolov[] = [];
  sotuvlar.forEach((s, i) => {
    if (s.tolovTuri !== "qarz") return;
    const t = rnd();
    if (t < 0.35) return; // hali to'lanmagan
    const mahsulot = MAHSULOTLAR.find((m) => m.kod === s.mahsulotKod)!;
    const jami = mahsulot.sotuvNarx * s.miqdor;
    // To'liq yoki qisman to'lov (yaxlit 10 ming so'mgacha).
    const ulush = t < 0.7 ? 1 : 0.4 + rnd() * 0.4;
    const summa = Math.round((jami * ulush) / 10_000) * 10_000;
    if (summa <= 0) return;
    // To'lov sotuvdan keyin, lekin bugundan oldin.
    const kunOldin = Math.max(0, s.kunOldin - 1 - Math.floor(rnd() * 5));
    tolovlar.push({ sotuvIndex: i, kunOldin, summa: Math.min(summa, jami) });
  });
  return tolovlar;
}

/**
 * CHIQIMLAR.
 *
 * Ikki turdagi pul chiqimi bor va ular ATAYLAB ajratilgan:
 *
 *  1. TOVAR XARIDI — ta'minotchiga kunlik hisob-kitob. Miqdori: o'sha kuni
 *     PULI TUSHGAN savdoning tannarx qismi (naqd sotuvlar + qarz to'lovining
 *     tannarxga to'g'ri keladigan ulushi). Ya'ni optom bazaning odatiy
 *     qoidasi — "pul kelgach ta'minotchiga to'laymiz".
 *     Nega ombor kirimida chiqim yozilmaydi: `createStockEntry` ham chiqim
 *     tranzaksiyasi YARATMAYDI (lib/services/inventory.ts) — omborga tovar
 *     kelishi o'z-o'zidan pul harakati emas.
 *  2. DOIMIY XARAJATLAR — ijara, oyliklar, kommunal (oyda bir marta),
 *     transport (haftada) va mayda xarajatlar.
 *
 * Shu sxemada sof foyda = savdo marjasi − doimiy xarajatlar, ya'ni raqam
 * o'z-o'zidan tushunarli bo'ladi.
 */
function chiqimlarniTuz(sotuvlar: DemoSotuv[], tolovlar: DemoQarzTolov[]): DemoChiqim[] {
  const rnd = tasodif(424242);
  const chiqimlar: DemoChiqim[] = [];
  const oylikJami = XODIMLAR.reduce((s, x) => s + x.stavka, 0);
  const narx = (kod: string) => MAHSULOTLAR.find((m) => m.kod === kod)!;

  for (let kun = DEMO_KUNLAR - 1; kun >= 0; kun--) {
    // Naqd sotuvlarning tannarxi.
    const naqdTannarx = sotuvlar
      .filter((s) => s.kunOldin === kun && s.tolovTuri === "naqd")
      .reduce((sum, s) => sum + narx(s.mahsulotKod).kelganNarx * s.miqdor, 0);
    // Qarz to'lovining tannarx ulushi: har to'langan so'mning tannarxga
    // to'g'ri keladigan qismi (tannarx / sotuv narxi nisbatida).
    const qarzTannarx = tolovlar
      .filter((t) => t.kunOldin === kun)
      .reduce((sum, t) => {
        const m = narx(sotuvlar[t.sotuvIndex].mahsulotKod);
        return sum + Math.round((t.summa * m.kelganNarx) / m.sotuvNarx);
      }, 0);
    const kunlikTannarx = naqdTannarx + qarzTannarx;
    if (kunlikTannarx > 0) {
      chiqimlar.push({
        kunOldin: kun,
        kategoriya: "Tovar xaridi",
        summa: kunlikTannarx,
        izoh: "Ta'minotchiga kunlik hisob-kitob",
        kassa: "naqd",
      });
    }

    // Oylik hisob-kitob kuni (davr ichida bir marta).
    if (kun === 9) {
      chiqimlar.push({ kunOldin: kun, kategoriya: "Ijara", summa: 4_500_000, izoh: "Ombor va ofis ijarasi", kassa: "naqd" });
      chiqimlar.push({ kunOldin: kun, kategoriya: "Oyliklar", summa: oylikJami, izoh: "Xodimlar oyligi", kassa: "naqd" });
      chiqimlar.push({ kunOldin: kun, kategoriya: "Kommunal", summa: 860_000, izoh: "Svet, suv, internet", kassa: "plastik" });
    }
    if (kun % 7 === 2) {
      chiqimlar.push({
        kunOldin: kun,
        kategoriya: "Transport",
        summa: 300_000 + Math.round((rnd() * 200_000) / 10_000) * 10_000,
        izoh: "Yetkazib berish yoqilg'isi",
        kassa: "naqd",
      });
    }
    if (rnd() < 0.25) {
      chiqimlar.push({
        kunOldin: kun,
        kategoriya: "Mayda xarajatlar",
        summa: 50_000 + Math.round((rnd() * 250_000) / 10_000) * 10_000,
        izoh: "Kundalik mayda xarajat",
        kassa: "naqd",
      });
    }
  }
  return chiqimlar;
}

/**
 * TERMINALDAN KASSAGA PUL YECHISH.
 *
 * Nega kerak: xarajatlar naqd kassadan to'lanadi, tushumning bir qismi esa
 * terminalga (Click) tushadi. O'tkazmasiz naqd kassa qoldig'i MANFIYGA
 * tushib ketardi — demo "singan" ko'rinardi. Haftada bir marta terminal
 * tushumining 90% i naqd kassaga o'tkaziladi (haqiqiy do'kon ham shunday
 * qiladi). O'tkazma kirim ham, chiqim ham emas — u sof foydaga ta'sir
 * qilmaydi (schema izohi: AccountTransfer).
 */
function otkazmalarniTuz(sotuvlar: DemoSotuv[]): DemoOtkazma[] {
  const narx = (kod: string) => MAHSULOTLAR.find((m) => m.kod === kod)!;
  const otkazmalar: DemoOtkazma[] = [];
  for (let hafta = 0; hafta * 7 < DEMO_KUNLAR; hafta++) {
    // Haftaning ENG YANGI kuni — o'tkazma o'sha kuni bajariladi.
    const kun = hafta * 7;
    const tushum = sotuvlar
      .filter(
        (s) =>
          s.tolovTuri === "naqd" &&
          s.kassa === "plastik" &&
          s.kunOldin >= kun &&
          s.kunOldin < kun + 7
      )
      .reduce((sum, s) => sum + narx(s.mahsulotKod).sotuvNarx * s.miqdor, 0);
    const summa = Math.round((tushum * 0.9) / 10_000) * 10_000;
    if (summa > 0) otkazmalar.push({ kunOldin: kun, summa });
  }
  return otkazmalar;
}

/**
 * OMBOR KIRIMLARI. Ikki partiya: boshlang'ich qoldiq va o'rtadagi to'ldirish.
 * Miqdorlar shunday tanlanadiki, HAR KUNI qoldiq manfiy bo'lmaydi va davr
 * oxirida `MAHSULOTLAR[].qoldiq` ga TENG bo'ladi.
 */
function omborKirimlariniTuz(sotuvlar: DemoSotuv[]): DemoReja["omborKirimlari"] {
  const TOLDIRISH_KUNI = 12; // bugundan 12 kun oldin
  const natija: DemoReja["omborKirimlari"] = {};
  for (const m of MAHSULOTLAR) {
    const sotilgan = sotuvlar
      .filter((s) => s.mahsulotKod === m.kod)
      .reduce((s, x) => s + x.miqdor, 0);
    // To'ldirishdan OLDIN (ya'ni kunOldin > TOLDIRISH_KUNI) sotilgan miqdor —
    // birinchi partiya kamida shuncha bo'lishi shart.
    const oldinSotilgan = sotuvlar
      .filter((s) => s.mahsulotKod === m.kod && s.kunOldin > TOLDIRISH_KUNI)
      .reduce((s, x) => s + x.miqdor, 0);
    const jami = sotilgan + m.qoldiq;
    const birinchi = Math.max(oldinSotilgan, Math.ceil(jami * 0.6));
    natija[m.kod] = [
      { kunOldin: DEMO_KUNLAR - 1, miqdor: birinchi },
      { kunOldin: TOLDIRISH_KUNI, miqdor: jami - birinchi },
    ].filter((p) => p.miqdor > 0);
  }
  return natija;
}

/** To'liq reja — bir marta hisoblanadi va ham seed, ham test shundan foydalanadi. */
export function demoReja(): DemoReja {
  const sotuvlar = sotuvlarniTuz();
  const qarzTolovlari = qarzTolovlariniTuz(sotuvlar);
  return {
    sotuvlar,
    qarzTolovlari,
    chiqimlar: chiqimlarniTuz(sotuvlar, qarzTolovlari),
    otkazmalar: otkazmalarniTuz(sotuvlar),
    omborKirimlari: omborKirimlariniTuz(sotuvlar),
  };
}

export interface DemoJamlar {
  /** Kirim = naqd sotuvlar + qarz to'lovlari (qarzga savdo kirim EMAS). */
  kirim: number;
  /** Chiqim = tovar xaridi + doimiy xarajatlar (ombor kirimi pul harakati emas). */
  chiqim: number;
  sofFoyda: number;
  /** Ochiq (to'lanmagan) qarz qoldig'i. */
  qarzQoldiq: number;
  /** Mahsulot kodi → davr oxiridagi ombor qoldig'i. */
  omborQoldiq: Record<string, number>;
  /** Ombordagi tovarning tannarxdagi qiymati. */
  omborQiymati: number;
}

/**
 * Reja bo'yicha yakuniy raqamlar. Test shu jamlarni bazadagi haqiqiy
 * yig'indilar bilan solishtiradi — "demo raqamlari mos" degani shu.
 */
export function demoJamlar(reja: DemoReja): DemoJamlar {
  const narx = (kod: string) => MAHSULOTLAR.find((m) => m.kod === kod)!;

  const naqdSotuv = reja.sotuvlar
    .filter((s) => s.tolovTuri === "naqd")
    .reduce((sum, s) => sum + narx(s.mahsulotKod).sotuvNarx * s.miqdor, 0);
  const qarzTolov = reja.qarzTolovlari.reduce((sum, t) => sum + t.summa, 0);

  // Ombor kirimi pul harakati EMAS (lib/services/inventory.ts) — chiqim
  // faqat yozilgan chiqim tranzaksiyalaridan iborat.
  const chiqim = reja.chiqimlar.reduce((sum, c) => sum + c.summa, 0);

  const qarzJami = reja.sotuvlar
    .filter((s) => s.tolovTuri === "qarz")
    .reduce((sum, s) => sum + narx(s.mahsulotKod).sotuvNarx * s.miqdor, 0);

  const omborQoldiq: Record<string, number> = {};
  for (const m of MAHSULOTLAR) omborQoldiq[m.kod] = m.qoldiq;

  const kirim = naqdSotuv + qarzTolov;
  return {
    kirim,
    chiqim,
    sofFoyda: kirim - chiqim,
    qarzQoldiq: qarzJami - qarzTolov,
    omborQoldiq,
    omborQiymati: MAHSULOTLAR.reduce((s, m) => s + m.qoldiq * m.kelganNarx, 0),
  };
}
