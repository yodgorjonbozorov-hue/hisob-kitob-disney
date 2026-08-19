/**
 * SUPERADMIN RBAC — Control Center huquq matritsasi (Superadmin 2.0).
 *
 * MUAMMO (2.0 gacha): superadmin huquqi BINAR edi — `rol === "SUPERADMIN"`
 * bo'lgan har kim mijozni bloklashi, tarifni o'zgartirishi, to'lovni
 * tasdiqlashi va bo'sh kompaniyani o'chirishi mumkin edi. Ya'ni qo'llab-quvvatlash
 * xodimiga panel ochish = unga butun platformani berish.
 *
 * YECHIM: superadmin ichida rol (`User.superadminRol`) va shu faylda yagona
 * huquq matritsasi. Matritsa client va serverda BIR XIL ishlatiladi, lekin
 * qaror HAR DOIM serverda qabul qilinadi (`withSuperadmin`) — frontend faqat
 * ko'rinishni boshqaradi.
 *
 * Bu modul client va serverda ishlatiladi — server-only import qo'shilmasin.
 */

export type SuperRol = "ROOT" | "ADMIN" | "SUPPORT" | "FINANCE" | "ANALYST" | "READ_ONLY";

export const SUPER_ROLLAR: SuperRol[] = [
  "ROOT",
  "ADMIN",
  "SUPPORT",
  "FINANCE",
  "ANALYST",
  "READ_ONLY",
];

export const SUPER_ROL_LABEL: Record<SuperRol, string> = {
  ROOT: "Root superadmin",
  ADMIN: "Administrator",
  SUPPORT: "Qo'llab-quvvatlash",
  FINANCE: "Moliya",
  ANALYST: "Analitik",
  READ_ONLY: "Faqat ko'rish",
};

export const SUPER_ROL_TAVSIF: Record<SuperRol, string> = {
  ROOT: "Cheklovsiz: tizim sozlamalari, admin hisoblar, kompaniya o'chirish.",
  ADMIN: "Kundalik boshqaruv: mijozlar, foydalanuvchilar, modullar, obuna, billing.",
  SUPPORT: "Mijozga yordam: ko'rish, parol tiklash, sessiya bekor qilish, tiketlar.",
  FINANCE: "Obuna, to'lov, tushum va eksport. Xavfsizlik sozlamalari yopiq.",
  ANALYST: "Faqat o'qish + eksport. Hech qanday o'zgartirish amali yo'q.",
  READ_ONLY: "Faqat ko'rish. Eksport ham yopiq.",
};

/** Huquq beriladigan bo'limlar (Control Center sektsiyalari). */
export type Resurs =
  | "dashboard"
  | "bizneslar"
  | "foydalanuvchilar"
  | "modullar"
  | "obunalar"
  | "billing"
  | "support"
  | "audit"
  | "xavfsizlik"
  | "tizim"
  | "sozlamalar"
  | "impersonatsiya"
  | "eksport";

/**
 * Amal darajalari. MANAGE eng kuchli daraja — u UPDATE ni O'Z ICHIGA OLMAYDI,
 * har amal ochiq beriladi (yashirin kengayish bo'lmasligi uchun).
 */
export type Amal = "VIEW" | "CREATE" | "UPDATE" | "DELETE" | "MANAGE";

export interface Ruxsat {
  resurs: Resurs;
  amal: Amal;
}

/** Qisqa yozuv: `r("bizneslar", "MANAGE")`. */
export function r(resurs: Resurs, amal: Amal): Ruxsat {
  return { resurs, amal };
}

type Matritsa = Partial<Record<Resurs, Amal[]>>;

/**
 * HUQUQ MATRITSASI.
 *
 * ROOT ro'yxatga kirmaydi — u alohida, `can()` da hamma narsaga "ha" deydi.
 * Sababi: yangi resurs qo'shilganda ROOT uni avtomatik oladi, boshqa rollar
 * esa OCHIQ qo'shilmaguncha OLMAYDI (fail-closed kengayish).
 */
const MATRITSA: Record<Exclude<SuperRol, "ROOT">, Matritsa> = {
  // Kundalik platforma boshqaruvchisi. Tizim sozlamalari va kompaniya
  // o'chirish ATAYLAB yopiq — bular qaytarib bo'lmaydigan amallar.
  ADMIN: {
    dashboard: ["VIEW"],
    bizneslar: ["VIEW", "CREATE", "UPDATE", "MANAGE"],
    foydalanuvchilar: ["VIEW", "UPDATE", "MANAGE"],
    modullar: ["VIEW", "MANAGE"],
    obunalar: ["VIEW", "UPDATE"],
    billing: ["VIEW", "UPDATE"],
    support: ["VIEW", "MANAGE"],
    audit: ["VIEW"],
    xavfsizlik: ["VIEW", "MANAGE"],
    tizim: ["VIEW"],
    sozlamalar: ["VIEW"],
    impersonatsiya: ["CREATE"],
    eksport: ["VIEW"],
  },
  // Mijozga yordam beradi: ko'radi, parol tiklaydi, sessiyani bekor qiladi,
  // tiket yuritadi. Pul, tarif, bloklash va tizim — YOPIQ.
  SUPPORT: {
    dashboard: ["VIEW"],
    bizneslar: ["VIEW"],
    foydalanuvchilar: ["VIEW", "UPDATE"],
    modullar: ["VIEW"],
    obunalar: ["VIEW"],
    billing: ["VIEW"],
    support: ["VIEW", "MANAGE"],
    audit: ["VIEW"],
    tizim: ["VIEW"],
  },
  // Moliya: obuna va to'lov bilan ishlaydi, eksport qiladi. Xavfsizlik,
  // foydalanuvchi boshqaruvi va tizim — YOPIQ.
  FINANCE: {
    dashboard: ["VIEW"],
    bizneslar: ["VIEW"],
    foydalanuvchilar: ["VIEW"],
    obunalar: ["VIEW", "UPDATE"],
    billing: ["VIEW", "UPDATE"],
    audit: ["VIEW"],
    eksport: ["VIEW"],
  },
  // Analitik: hech narsa o'zgartirmaydi, lekin eksport qila oladi.
  ANALYST: {
    dashboard: ["VIEW"],
    bizneslar: ["VIEW"],
    foydalanuvchilar: ["VIEW"],
    modullar: ["VIEW"],
    obunalar: ["VIEW"],
    billing: ["VIEW"],
    audit: ["VIEW"],
    tizim: ["VIEW"],
    eksport: ["VIEW"],
  },
  // Eng tor daraja: faqat ko'rish, eksport ham yo'q (ma'lumot chiqmaydi).
  READ_ONLY: {
    dashboard: ["VIEW"],
    bizneslar: ["VIEW"],
    foydalanuvchilar: ["VIEW"],
    modullar: ["VIEW"],
    obunalar: ["VIEW"],
  },
};

/**
 * Bazadagi qiymatni SuperRol ga aylantiradi.
 *
 * NULL -> "ROOT". Bu ATAYLAB: 2.0 gacha har superadmin cheklovsiz edi, ya'ni
 * NULL aynan o'sha eski holatni bildiradi va bu yerda imtiyoz QO'SHILMAYDI.
 * Migratsiya mavjud superadminlarni 'ROOT' qilib to'ldiradi, shuning uchun
 * amalda NULL faqat migratsiyagacha ochilgan yozuvlarda uchraydi.
 * Noma'lum qiymat esa eng tor rolga (READ_ONLY) tushadi — fail-closed.
 */
export function superRolNormalize(qiymat: string | null | undefined): SuperRol {
  if (qiymat == null || qiymat === "") return "ROOT";
  return (SUPER_ROLLAR as string[]).includes(qiymat) ? (qiymat as SuperRol) : "READ_ONLY";
}

/** Shu rolda `resurs` ustida `amal` bajarish mumkinmi. */
export function can(rol: SuperRol, resurs: Resurs, amal: Amal): boolean {
  if (rol === "ROOT") return true;
  return MATRITSA[rol]?.[resurs]?.includes(amal) ?? false;
}

/** `Ruxsat` obyekti bilan tekshirish (route guard'lari uchun). */
export function canRuxsat(rol: SuperRol, ruxsat: Ruxsat): boolean {
  return can(rol, ruxsat.resurs, ruxsat.amal);
}

/** Rolning to'liq matritsasi — Sozlamalar → Rollar sahifasidagi jadval uchun. */
export function rolMatritsasi(rol: SuperRol): Record<Resurs, Amal[]> {
  const barchaResurslar: Resurs[] = [
    "dashboard",
    "bizneslar",
    "foydalanuvchilar",
    "modullar",
    "obunalar",
    "billing",
    "support",
    "audit",
    "xavfsizlik",
    "tizim",
    "sozlamalar",
    "impersonatsiya",
    "eksport",
  ];
  const barchaAmallar: Amal[] = ["VIEW", "CREATE", "UPDATE", "DELETE", "MANAGE"];
  const natija = {} as Record<Resurs, Amal[]>;
  for (const resurs of barchaResurslar) {
    natija[resurs] = barchaAmallar.filter((amal) => can(rol, resurs, amal));
  }
  return natija;
}

export const RESURS_LABEL: Record<Resurs, string> = {
  dashboard: "Bosh sahifa",
  bizneslar: "Bizneslar",
  foydalanuvchilar: "Foydalanuvchilar",
  modullar: "Modullar",
  obunalar: "Obunalar",
  billing: "Billing",
  support: "Support",
  audit: "Audit",
  xavfsizlik: "Xavfsizlik",
  tizim: "Tizim",
  sozlamalar: "Sozlamalar",
  impersonatsiya: "Impersonatsiya",
  eksport: "Eksport",
};
