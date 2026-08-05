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
      { href: "/app/kassa", label: "Kassalar", icon: "wallet", tartib: 14, rollar: BOSHQARUVCHILAR },
      { href: "/app/takroriy", label: "Takroriy", icon: "repeat", tartib: 40, rollar: BOSHQARUVCHILAR },
      { href: "/app/smena", label: "Kun yakuni", icon: "shift", tartib: 41, rollar: ["OWNER", "ADMIN", "CASHIER"] },
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
      { href: "/app/qarzlar", label: "Qarzlar", icon: "debt", tartib: 22, rollar: ["OWNER", "ADMIN", "CASHIER"] },
    ],
  },
  {
    code: "XARID",
    nomi: "Xarid",
    tavsif:
      "Ta'minotchilar reyestri, xarid buyurtmasi va qabul qilish. Qabul qilinganda tovar omborga tushadi, chiqim yoki ta'minotchiga qarz avtomatik yoziladi.",
    core: false,
    // Xarid — pul va ombor qarori, shuning uchun faqat boshqaruvchilar.
    rollar: BOSHQARUVCHILAR,
    nav: [
      { href: "/app/xarid", label: "Xarid", icon: "purchase", tartib: 23, rollar: BOSHQARUVCHILAR },
      { href: "/app/xarid/taminotchilar", label: "Ta'minotchilar", icon: "supplier", tartib: 24, rollar: BOSHQARUVCHILAR },
    ],
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
    code: "CRM",
    nomi: "CRM — mijozlar va bitimlar",
    tavsif: "Lead va bitimlar kanbani, kontaktlar, faoliyat tarixi. Yutilgan bitim 1 klikda kirimga aylanadi.",
    core: false,
    // Sotuvchining asosiy ish quroli — SELLER'ga to'liq ochiq (foydalanuvchi qarori).
    rollar: ["OWNER", "ADMIN", "SELLER"],
    nav: [
      { href: "/app/crm", label: "CRM", icon: "crm", tartib: 30, rollar: ["OWNER", "ADMIN", "SELLER"] },
      { href: "/app/crm/kontaktlar", label: "Kontaktlar", icon: "contacts", tartib: 31, rollar: ["OWNER", "ADMIN", "SELLER"] },
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
  /** Aktiv biznes avto rejimidami — OMBOR yorliqlari "Avtopark/Mashina sotish" bo'ladi. */
  avto?: boolean;
}

/** Avto rejimidagi biznes uchun OMBOR moduli yorliqlari (lib/biznesTuri.ts bilan mos). */
const AVTO_YORLIQLAR: Record<string, string> = {
  "/app/ombor": "Avtopark",
  "/app/sotuv": "Mashina sotish",
};

/** Sidebar/menyu uchun tartiblangan havolalar ro'yxati. */
export function computeNav({ rol, yoqilgan, omborli, avto = false }: NavHolati): NavItem[] {
  const items: NavItem[] = [];
  for (const m of MODULLAR) {
    if (!m.core && !yoqilgan.has(m.code)) continue;
    if (m.code === "OMBOR" && !omborli) continue;
    if (!m.rollar.includes(rol)) continue;
    for (const item of m.nav) {
      if (!item.rollar.includes(rol)) continue;
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
  if (manager) tabs.push({ href: "/app", label: "Asosiy", icon: "home" });
  tabs.push({ href: "/app/tranzaksiyalar", label: "Yozuvlar", icon: "list" });
  if (holat.rol === "SELLER") {
    // Sotuvchi uchun CRM — asosiy ish quroli.
    if (crmBor) tabs.push({ href: "/app/crm", label: "CRM", icon: "crm" });
    return tabs;
  }
  const omborBor = holat.yoqilgan.has("OMBOR") && holat.omborli;
  if (omborBor) tabs.push({ href: "/app/sotuv", label: holat.avto ? "Sotish" : "Sotuv", icon: "cart" });
  else if (crmBor) tabs.push({ href: "/app/crm", label: "CRM", icon: "crm" });
  else if (manager) tabs.push({ href: "/app/hisobot", label: "Hisobot", icon: "chart" });
  return tabs;
}
