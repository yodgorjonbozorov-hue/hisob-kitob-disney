import type { Rol } from "@/lib/auth/roles";
import { isManager } from "@/lib/auth/roles";

/**
 * MODUL KATALOGI — Business OS'ning yagona haqiqat manbai.
 *
 * Har modul: nomi, navigatsiya havolalari, rol matritsasi. Sidebar, BottomNav
 * va CommandPalette havolalari SHU YERDAN generatsiya qilinadi — yangi modul
 * qo'shilganda UI komponentlariga tegilmaydi.
 *
 * Qaysi tenant qaysi modulni yoqqani bazada (TenantModule), qaysi tarifda
 * qaysi modul borligi lib/billing/plans.ts da.
 *
 * Client va server ikkalasida ishlatiladi — server-only import qo'shilmasin.
 */

export interface NavItem {
  href: string;
  label: string;
  /** Ikonka kaliti — Sidebar o'z lucide xaritasidan oladi. */
  icon: string;
  /** Global tartib — sidebar shu bo'yicha saralanadi. */
  tartib: number;
  /** Qaysi rollar ko'radi. */
  rollar: Rol[];
  /** Faqat PRO tarifda ko'rinadi — boshqa mijozlar menyusi O'ZGARMAYDI. */
  faqatPro?: boolean;
  /**
   * Faqat kg savdosi ochilgan mijozda ko'rinadi (mijozga xos — lib/mijozXos.ts).
   * Tarif imkoniyati EMAS: boshqa mijozlar menyusi O'ZGARMAYDI.
   */
  faqatKgSavdo?: boolean;
}

export interface ModulTarifi {
  code: string;
  nomi: string;
  tavsif: string;
  /** Core modul — o'chirib bo'lmaydi, TenantModule yozuvisiz ham yoqilgan. */
  core: boolean;
  /** Sozlamalar sahifasida kartochka sifatida ko'rsatilmaydi (sof nav-konteyner). */
  korinmas?: boolean;
  /** Modul rollari: bu modulga umuman kira oladigan rollar (nav'dan tashqari API himoya). */
  rollar: Rol[];
  /**
   * Yoqishdan oldin tasdiq so'raladi va shu ro'yxat ko'rsatiladi ("nima
   * qo'shiladi"). Bo'sh bo'lsa modul bir bosishda yoqiladi (avvalgi
   * xatti-harakat — mavjud modullar uchun hech narsa o'zgarmaydi).
   */
  qoshiladi?: string[];
  nav: NavItem[];
}

const BOSHQARUVCHILAR: Rol[] = ["OWNER", "ADMIN"];
const HAMMA: Rol[] = ["OWNER", "ADMIN", "CASHIER", "SELLER"];

export const MODULLAR: ModulTarifi[] = [
  {
    code: "MOLIYA",
    nomi: "Moliya",
    tavsif: "Kirim-chiqim, budjet, takroriy to'lovlar, kun yakuni va oylik hisobotlar (PDF/Excel).",
    core: true,
    rollar: HAMMA,
    nav: [
      { href: "/app", label: "Asosiy", icon: "dashboard", tartib: 10, rollar: BOSHQARUVCHILAR },
      { href: "/app/tranzaksiyalar", label: "Yozuvlar", icon: "receipt", tartib: 11, rollar: HAMMA },
      { href: "/app/hisobot", label: "Oylik hisobot", icon: "report", tartib: 12, rollar: BOSHQARUVCHILAR },
      { href: "/app/byudjet", label: "Budjet", icon: "budget", tartib: 13, rollar: BOSHQARUVCHILAR },
      // KASSALAR — kassirga ham ochiq: u boshqa kassalarda qancha pul borligini
      // ko'rishi va ularga pul o'tkazishi kerak. Sahifadagi BOSHQARUV amallari
      // (kassa ochish/o'chirish, rejim) baribir huquq bilan qulflangan.
      {
        href: "/app/kassa",
        label: "Kassalar",
        icon: "wallet",
        tartib: 14,
        rollar: ["OWNER", "ADMIN", "CASHIER"],
      },
      // QARZLAR — MOLIYA ichida, OMBOR emas. Qarz ombordan mustaqil moliyaviy
      // majburiyat: ombori yo'q biznes ham "Kirim → Qarz" yozadi va uni
      // ko'radigan joyi bo'lishi shart.
      { href: "/app/qarzlar", label: "Qarzlar", icon: "debt", tartib: 16, rollar: ["OWNER", "ADMIN", "CASHIER"] },
      // "Mening kassam" — direktor ham yozuv kiritadi va uning qo'lida ham
      // naqd qolishi mumkin, shuning uchun boshqaruvchilarga ham ochiq.
      // SELLER menyusi ATAYLAB tegilmaydi ("Sotuvchi faqat Yozuvlar ko'radi"
      // qoidasi) — u o'z kassasiga Yozuvlar sahifasidagi karta orqali kiradi.
      { href: "/app/kassam", label: "Mening kassam", icon: "cash", tartib: 17, rollar: ["OWNER", "ADMIN", "CASHIER"] },
      // KG SAVDOSI kesimi (mijozga xos — Fortex Selos): bugun necha kg sotildi,
      // qaysi sotuvchi/kassa bo'yicha va o'rtacha narx qancha. Kassir ham
      // ko'radi — u o'z savdosini tekshirib turishi kerak.
      {
        href: "/app/selos",
        label: "Kg savdosi",
        icon: "weight",
        tartib: 18,
        rollar: ["OWNER", "ADMIN", "CASHIER", "SELLER"],
        faqatKgSavdo: true,
      },
      { href: "/app/takroriy", label: "Takroriy", icon: "repeat", tartib: 40, rollar: BOSHQARUVCHILAR },
      { href: "/app/smena", label: "Kun yakuni", icon: "shift", tartib: 41, rollar: ["OWNER", "ADMIN", "CASHIER"] },
    ],
  },
  {
    code: "KUNLIK",
    nomi: "Kunlik hisobot",
    tavsif:
      "Kun davomida tushumlar (naqd, Click, qarz) alohida yuritiladi, kun yakunini tayinlangan direktor tasdiqlaydi. Oylik hisobot va kassa qoldig'iga ta'sir qilmaydi.",
    core: false,
    // Tushum kiritish — xodimning asosiy amali, shuning uchun hammaga ochiq;
    // tasdiqlash/tarix server tomonda direktor/boshqaruvchi bilan cheklanadi.
    rollar: HAMMA,
    nav: [
      { href: "/app/kunlik", label: "Kunlik hisobot", icon: "daily", tartib: 15, rollar: HAMMA },
    ],
  },
  {
    code: "OMBOR",
    nomi: "Ombor va sotuv",
    tavsif: "Mahsulot qoldig'i, sotuv (naqd/qarz), qarzdorlik nazorati. Tovar sotadigan bizneslar uchun.",
    core: false,
    // Sotuvchi (SELLER) faqat kirim/chiqim kiritadi — ombor unga yopiq (foydalanuvchi qarori).
    rollar: ["OWNER", "ADMIN", "CASHIER"],
    nav: [
      { href: "/app/ombor", label: "Ombor", icon: "package", tartib: 20, rollar: BOSHQARUVCHILAR },
      { href: "/app/sotuv", label: "Sotuv", icon: "cart", tartib: 21, rollar: ["OWNER", "ADMIN", "CASHIER"] },
      // "Qarzlar" ataylab bu yerda EMAS — u MOLIYA (core) modulida, chunki
      // qarz ombori yo'q bizneslarda ham yuritiladi.
    ],
  },
  {
    code: "MAGAZIN",
    nomi: "Magazin (kassa / POS)",
    tavsif:
      "Do'kon kassasi: shtrix-kod skaneri bilan savat yig'ish, bitta chekda ko'p mahsulot sotish, " +
      "QR/barcode chop etish va chekni qaytarish. Chakana savdo qiladigan bizneslar uchun.",
    core: false,
    // MAGAZIN — OMBOR ustidagi qatlam: mahsulot, qoldiq va sotuv tarixi
    // O'SHA modulda yuritiladi. Shu bois bu yerda "Mahsulotlar"/"Ombor"/
    // "Sotuvlar" havolalari ATAYLAB TAKRORLANMAYDI.
    // Bog'liqlikning O'ZI `lib/modules/bogliqlik.ts` da (yagona manba).
    qoshiladi: [
      "Kassir ekrani (POS) — skaner bilan savat yig'ish",
      "Bitta chekda bir nechta mahsulot sotish",
      "To'lov: naqd, karta, Click yoki qarz",
      "QR va shtrix-kod: biriktirish, chop etish, skanerlash",
      "Cheklar tarixi va chekni to'liq qaytarish",
    ],
    // Kassir — bu modulning ASOSIY foydalanuvchisi. Sotuvchi (SELLER) kassaga
    // kirmaydi: u faqat kirim/chiqim kiritadi (OMBOR bilan bir xil qoida).
    rollar: ["OWNER", "ADMIN", "CASHIER"],
    nav: [
      { href: "/app/pos", label: "Kassa (POS)", icon: "pos", tartib: 19, rollar: ["OWNER", "ADMIN", "CASHIER"] },
      { href: "/app/pos/cheklar", label: "Cheklar", icon: "chek", tartib: 22, rollar: ["OWNER", "ADMIN", "CASHIER"] },
      { href: "/app/pos/qr", label: "QR / Shtrix-kod", icon: "qr", tartib: 22, rollar: BOSHQARUVCHILAR },
    ],
  },
  {
    code: "XARID",
    nomi: "Xarid (rejali buyurtma)",
    tavsif:
      "Oldindan rejalashtiriladigan xarid buyurtmasi: qoralama \u2192 tasdiqlash \u2192 qabul qilish. " +
      "Kundalik \"tovar keldi\" oqimi va ta'minotchilar reyestri endi OMBOR modulida \u2014 " +
      "bu modul faqat reja bilan ishlaydigan bizneslarga kerak.",
    core: false,
    // Xarid — pul va ombor qarori, shuning uchun faqat boshqaruvchilar.
    rollar: BOSHQARUVCHILAR,
    // NAV ATAYLAB BO'SH. Ilgari yon panelda "Xarid" va "Ta'minotchilar"
    // alohida turardi va foydalanuvchi "tovar keldi" deyish uchun qaysi
    // bo'limga borishni o'ylashi kerak edi. Endi ikkalasi ham Ombor ichida:
    //   /app/ombor?tab=taminotlar   — kelgan tovarlar tarixi;
    //   /app/ombor/taminotchilar    — reyestr.
    // Modul o'zi saqlanib qoldi: eski buyurtma yozuvlari va `/api/xarid/*`
    // ishlayveradi, faqat yon panelda takroriy punkt qolmadi.
    nav: [],
  },
  {
    code: "TASDIQLASH",
    nomi: "Tasdiqlash",
    tavsif:
      "Chegaradan oshgan chiqim darhol yozilmaydi — rahbar tasdig'ini kutadi. Tasdiqlash Telegramdagi tugma orqali ham mumkin.",
    core: false,
    // Xodim o'z so'rovini ko'radi; qaror faqat boshqaruvchida.
    rollar: HAMMA,
    nav: [
      { href: "/app/tasdiqlash", label: "Tasdiqlash", icon: "approval", tartib: 25, rollar: HAMMA },
      { href: "/app/tasdiqlash/qoidalar", label: "Tasdiq qoidalari", icon: "rule", tartib: 26, rollar: BOSHQARUVCHILAR },
    ],
  },
  {
    code: "MIJOZLAR",
    nomi: "Mijozlar",
    tavsif:
      "Mijoz kartochkasi: barcha sotuvlar, qarzlar va CRM bitimlari bitta sahifada. Qarz limiti — chegaradan oshgan qarzga sotuv rad etiladi.",
    core: false,
    rollar: HAMMA,
    nav: [
      { href: "/app/mijozlar", label: "Mijozlar", icon: "customers", tartib: 27, rollar: HAMMA },
    ],
  },
  {
    code: "HR",
    nomi: "Xodimlar (HR-lite)",
    tavsif:
      "Xodim kartochkasi, davomat va oylik: stavka, avans, ushlab qolish va ustama. Oylik to'langanda chiqim tranzaksiya avtomatik yoziladi.",
    core: false,
    // Oylik — pul va shaxsiy ma'lumot, shuning uchun faqat boshqaruvchilar.
    rollar: BOSHQARUVCHILAR,
    nav: [
      { href: "/app/hr", label: "Xodimlar", icon: "hr", tartib: 28, rollar: BOSHQARUVCHILAR },
      { href: "/app/hr/davomat", label: "Davomat", icon: "attendance", tartib: 29, rollar: BOSHQARUVCHILAR },
    ],
  },
  {
    code: "HUJJATLAR",
    nomi: "Hujjatlar",
    tavsif:
      "Shartnomalar reyestri muddat eslatmasi bilan va yozuvlarga fayl biriktirish. Fayl saqlagich sozlanmagan bo'lsa tashqi havola bilan ishlaydi.",
    core: false,
    rollar: HAMMA,
    nav: [
      { href: "/app/hujjatlar", label: "Shartnomalar", icon: "contract", tartib: 30, rollar: HAMMA },
    ],
  },
  {
    code: "CRM",
    nomi: "CRM — mijozlar va bitimlar",
    tavsif: "Lead va bitimlar kanbani, kontaktlar, faoliyat tarixi. Yutilgan bitim 1 klikda kirimga aylanadi.",
    core: false,
    // KUNLIK BUYURTMA — savdo maydonidagi HAR bir xodimning ish quroli.
    //
    // Ilgari bu yerda faqat SELLER turardi va "sotuvchi" deb ishlaydigan,
    // lekin hisobi CASHIER rolida ochilgan xodimlarga CRM umuman
    // KO'RINMASDI (nav ham, sahifa ham, API ham shu ro'yxatdan o'qiladi).
    // Buyurtma qabul qilish va to'lov olingach uni kirimga o'tkazish —
    // ikkala rol uchun ham bir xil kundalik amal, shuning uchun modul
    // biznesdagi barcha rollarga ochiq.
    //
    // DIQQAT: bu faqat CRM. Boshqaruv bo'limlari (Bizneslar,
    // Foydalanuvchilar, Audit, Hisobot, Modullar) o'z ro'yxatlari bilan
    // BOSHQARUVCHILAR'da qolgan — bu o'zgarish ularga tegmaydi.
    rollar: HAMMA,
    nav: [
      { href: "/app/crm", label: "CRM", icon: "crm", tartib: 30, rollar: HAMMA },
      { href: "/app/crm/kontaktlar", label: "Kontaktlar", icon: "contacts", tartib: 31, rollar: HAMMA },
    ],
  },
  {
    code: "VAZIFALAR",
    nomi: "Vazifalar",
    tavsif: "Jamoa vazifalari: mas'ul, muddat, 3 ustunli kanban. CRM bitimlariga bog'lanadi.",
    core: false,
    rollar: HAMMA,
    nav: [
      { href: "/app/vazifalar", label: "Vazifalar", icon: "tasks", tartib: 35, rollar: HAMMA },
    ],
  },
  {
    code: "AI",
    nomi: "AI yordamchi",
    tavsif: "Biznesingiz raqamlari bo'yicha savol-javob: \"Bu oy qanday o'tdi?\", \"Qaysi chiqim oshdi?\" — AI faqat sizning ma'lumotingizni ko'radi.",
    core: false,
    rollar: BOSHQARUVCHILAR,
    nav: [
      { href: "/app/ai", label: "AI yordamchi", icon: "ai", tartib: 14, rollar: BOSHQARUVCHILAR },
    ],
  },
  {
    code: "BOSHQARUV",
    nomi: "Boshqaruv",
    tavsif: "Bizneslar, kategoriyalar, foydalanuvchilar, audit va obuna.",
    core: true,
    korinmas: true,
    rollar: BOSHQARUVCHILAR,
    nav: [
      { href: "/app/admin/bizneslar", label: "Bizneslar", icon: "business", tartib: 50, rollar: BOSHQARUVCHILAR },
      { href: "/app/admin/kategoriyalar", label: "Kategoriyalar", icon: "tags", tartib: 51, rollar: BOSHQARUVCHILAR },
      { href: "/app/admin/foydalanuvchilar", label: "Foydalanuvchilar", icon: "users", tartib: 52, rollar: BOSHQARUVCHILAR },
      { href: "/app/admin/rollar", label: "Rollar va huquqlar", icon: "shield", tartib: 52, rollar: BOSHQARUVCHILAR, faqatPro: true },
      { href: "/app/admin/ochirilganlar", label: "O'chirilganlar", icon: "trash", tartib: 53, rollar: BOSHQARUVCHILAR },
      { href: "/app/admin/audit", label: "Audit jurnali", icon: "audit", tartib: 54, rollar: BOSHQARUVCHILAR },
      { href: "/app/sozlamalar/modullar", label: "Modullar", icon: "modules", tartib: 55, rollar: ["OWNER"] },
      { href: "/billing", label: "Obuna va to'lov", icon: "billing", tartib: 56, rollar: BOSHQARUVCHILAR },
    ],
  },
];

export function modulByCode(code: string): ModulTarifi | null {
  return MODULLAR.find((m) => m.code === code) ?? null;
}

/** Sozlamalar sahifasida ko'rsatiladigan (toggle qilinadigan yoki core) modullar. */
export function korinadiganModullar(): ModulTarifi[] {
  return MODULLAR.filter((m) => !m.korinmas);
}

// ---------------------------------------------------------------------------
// Navigatsiya generatsiyasi — Sidebar/BottomNav/CommandPalette uchun BITTA manba.
// ---------------------------------------------------------------------------

export interface NavHolati {
  rol: Rol;
  /** Tenant uchun yoqilgan modul kodlari (core'lar kiritilgan). */
  yoqilgan: Set<string>;
  /** Aktiv biznes omborli'mi — OMBOR nav'i faqat shunda ko'rinadi. */
  omborli: boolean;
  /**
   * Aktiv bizneste magazin (kassa) yuritiladimi — MAGAZIN nav'i faqat shunda
   * ko'rinadi. `omborli` bilan bir xil qoida: modul TENANT darajasida, bayroq
   * BIZNES darajasida. Berilmasa false — mavjud bizneslarda menyu O'ZGARMAYDI.
   */
  magazin?: boolean;
  /** Aktiv biznes avto rejimidami — OMBOR yorliqlari "Avtopark/Mashina sotish" bo'ladi. */
  avto?: boolean;
  /** Tenant PRO tarifdami — `faqatPro` havolalar faqat shunda ko'rinadi. */
  pro?: boolean;
  /**
   * Kg savdosi shu mijozga ochiqmi (mijozga xos — lib/mijozXos.ts).
   * `faqatKgSavdo` havolalar faqat shunda ko'rinadi.
   */
  kgSavdo?: boolean;
}

/** Avto rejimidagi biznes uchun OMBOR moduli yorliqlari (lib/biznesTuri.ts bilan mos). */
const AVTO_YORLIQLAR: Record<string, string> = {
  "/app/ombor": "Avtopark",
  "/app/sotuv": "Mashina sotish",
};

/** Sidebar/menyu uchun tartiblangan havolalar ro'yxati. */
export function computeNav({
  rol,
  yoqilgan,
  omborli,
  magazin = false,
  avto = false,
  pro = false,
  kgSavdo = false,
}: NavHolati): NavItem[] {
  const items: NavItem[] = [];
  for (const m of MODULLAR) {
    if (!m.core && !yoqilgan.has(m.code)) continue;
    if (m.code === "OMBOR" && !omborli) continue;
    // MAGAZIN — do'kon kassasi. Ikki shart ham kerak: tenant modulni yoqqan
    // BO'LSA HAM, mahsulot va qoldiq yuritilmaydigan bizneste kassaning
    // ma'nosi yo'q.
    if (m.code === "MAGAZIN" && (!magazin || !omborli)) continue;
    if (!m.rollar.includes(rol)) continue;
    for (const item of m.nav) {
      if (!item.rollar.includes(rol)) continue;
      if (item.faqatPro && !pro) continue;
      if (item.faqatKgSavdo && !kgSavdo) continue;
      const label = avto ? AVTO_YORLIQLAR[item.href] ?? item.label : item.label;
      items.push(label === item.label ? item : { ...item, label });
    }
  }
  return items.sort((a, b) => a.tartib - b.tartib);
}

export interface MobileTab {
  href: string;
  label: string;
  icon: string;
}

/** Mobil pastki panel: maksimal 3 tab (o'rtada FAB) — qolgani Menyu'da. */
export function computeMobileTabs(holat: NavHolati): MobileTab[] {
  const tabs: MobileTab[] = [];
  const manager = isManager(holat.rol);
  const crmBor = holat.yoqilgan.has("CRM") && modulByCode("CRM")!.rollar.includes(holat.rol);
  // Kunlik tushum kiritish — xodimning (kassir/sotuvchi) kundalik quroli,
  // shuning uchun modul yoqilgan bo'lsa u pastki panelda tab bo'ladi.
  const kunlikBor = holat.yoqilgan.has("KUNLIK") && modulByCode("KUNLIK")!.rollar.includes(holat.rol);
  if (manager) tabs.push({ href: "/app", label: "Asosiy", icon: "home" });
  tabs.push({ href: "/app/tranzaksiyalar", label: "Yozuvlar", icon: "list" });
  if (holat.rol === "SELLER") {
    if (kunlikBor) tabs.push({ href: "/app/kunlik", label: "Kunlik", icon: "daily" });
    // Sotuvchi uchun CRM — asosiy ish quroli.
    if (crmBor && tabs.length < 3) tabs.push({ href: "/app/crm", label: "CRM", icon: "crm" });
    return tabs;
  }
  if (!manager && kunlikBor) tabs.push({ href: "/app/kunlik", label: "Kunlik", icon: "daily" });
  const omborBor = holat.yoqilgan.has("OMBOR") && holat.omborli;
  // Do'konda kassirning yagona ekrani — POS. Sotuv formasidan ustun turadi.
  const posBor =
    omborBor &&
    holat.yoqilgan.has("MAGAZIN") &&
    !!holat.magazin &&
    modulByCode("MAGAZIN")!.rollar.includes(holat.rol);
  if (tabs.length < 3) {
    if (posBor) tabs.push({ href: "/app/pos", label: "Kassa", icon: "pos" });
    else if (omborBor) tabs.push({ href: "/app/sotuv", label: holat.avto ? "Sotish" : "Sotuv", icon: "cart" });
    else if (crmBor) tabs.push({ href: "/app/crm", label: "CRM", icon: "crm" });
    else if (manager) tabs.push({ href: "/app/hisobot", label: "Hisobot", icon: "chart" });
  }
  return tabs;
}
