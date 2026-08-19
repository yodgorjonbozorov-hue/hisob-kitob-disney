import { can, type Resurs, type SuperRol } from "./rbac";

/**
 * CONTROL CENTER NAVIGATSIYASI — yagona manba.
 *
 * Sidebar, topbar breadcrumb va command palette SHU ro'yxatdan quriladi.
 * Har bo'lim o'z RESURSINI e'lon qiladi, ya'ni menyu rolga qarab avtomatik
 * qisqaradi — alohida "kim nimani ko'radi" ro'yxati saqlanmaydi.
 *
 * DIQQAT: menyudan yashirish HIMOYA EMAS. Haqiqiy tekshiruv sahifada
 * (`requireSuperadminRuxsat`) va API'da (`withSuperadmin`) bo'ladi.
 */

export interface SaNavBolim {
  href: string;
  label: string;
  /** Ikonka kaliti — Sidebar o'z lucide xaritasidan oladi. */
  icon: string;
  resurs: Resurs;
  /** Qisqacha izoh — command palette'da ko'rsatiladi. */
  izoh: string;
}

export const SA_NAV: SaNavBolim[] = [
  { href: "/superadmin", label: "Bosh sahifa", icon: "overview", resurs: "dashboard", izoh: "KPI, ogohlantirishlar va oxirgi faoliyat" },
  { href: "/superadmin/bizneslar", label: "Bizneslar", icon: "business", resurs: "bizneslar", izoh: "Mijoz kompaniyalar va ularning holati" },
  { href: "/superadmin/foydalanuvchilar", label: "Foydalanuvchilar", icon: "users", resurs: "foydalanuvchilar", izoh: "Platformadagi barcha hisoblar" },
  { href: "/superadmin/obunalar", label: "Obunalar", icon: "subscription", resurs: "obunalar", izoh: "Tariflar, muddatlar va MRR" },
  { href: "/superadmin/billing", label: "Billing", icon: "billing", resurs: "billing", izoh: "To'lovlar, tushum va muammoli to'lovlar" },
  { href: "/superadmin/modullar", label: "Modullar", icon: "modules", resurs: "modullar", izoh: "Modul qamrovi va bog'liqliklar" },
  { href: "/superadmin/support", label: "Support", icon: "support", resurs: "support", izoh: "Mijoz tiketlari" },
  { href: "/superadmin/audit", label: "Audit va xavfsizlik", icon: "audit", resurs: "audit", izoh: "O'zgarmas jurnal va xavfsizlik markazi" },
  { href: "/superadmin/tizim", label: "Tizim", icon: "system", resurs: "tizim", izoh: "Komponentlar sog'lig'i, zaxira, baza" },
  { href: "/superadmin/sozlamalar", label: "Sozlamalar", icon: "settings", resurs: "sozlamalar", izoh: "Admin hisoblar, rollar, feature flag'lar" },
];

/** Shu rolga ko'rinadigan bo'limlar. */
export function navBolimlar(rol: SuperRol): SaNavBolim[] {
  return SA_NAV.filter((b) => can(rol, b.resurs, "VIEW"));
}

/** Joriy yo'l uchun bo'lim (breadcrumb va sarlavha uchun). */
export function bolimniTop(pathname: string): SaNavBolim | null {
  // Eng uzun mos keladigan yo'l tanlanadi: "/superadmin/bizneslar/xyz" -> Bizneslar.
  let natija: SaNavBolim | null = null;
  for (const b of SA_NAV) {
    if (pathname === b.href || pathname.startsWith(`${b.href}/`)) {
      if (!natija || b.href.length > natija.href.length) natija = b;
    }
  }
  return natija;
}
