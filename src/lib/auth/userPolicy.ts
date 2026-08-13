import type { Rol } from "./roles";

/**
 * FOYDALANUVCHI BOSHQARUVI QOIDALARI (H-1) — sof funksiyalar.
 *
 * `api/users` route'laridan ajratilgan: tenant ichida hisob egallashning
 * oldini oladigan qoidalar bir joyda turadi va DB'siz testlanadi.
 *
 * Nega kerak: ilgari requireManager'dan o'tgan HAR KIM (ADMIN ham) istalgan
 * foydalanuvchi parolini eski parolsiz almashtirib, unga OWNER roli berib,
 * hisobni egallashi mumkin edi. Yagona OWNER esa o'zini CASHIER qilib butun
 * kompaniyani boshqaruvsiz qoldira olardi.
 */

export interface UserPolicyXato {
  xato: string;
  status: number;
}

/** PATCH /api/users/[id] uchun tekshiruv. `null` — ruxsat. */
export function userTahririniTekshir(params: {
  aktor: { userId: string; rol: Rol };
  target: { id: string; rol: Rol; isActive: boolean };
  ozgarish: { rol?: Rol; isActive?: boolean };
  /** Tenantdagi faol OWNER soni (oxirgi direktor himoyasi uchun). */
  faolOwnerSoni: number;
}): UserPolicyXato | null {
  const { aktor, target, ozgarish } = params;
  const ozini = target.id === aktor.userId;

  // Direktor hisobini faqat boshqa DIREKTOR tahrirlaydi — ADMIN direktor
  // parolini almashtirib hisobni egallay olmasin.
  if (target.rol === "OWNER" && aktor.rol !== "OWNER") {
    return { xato: "Direktor hisobini faqat boshqa direktor tahrirlashi mumkin", status: 403 };
  }
  // OWNER rolini faqat OWNER beradi — ADMIN o'zidan yuqori rol tarqata olmasin.
  if (ozgarish.rol === "OWNER" && aktor.rol !== "OWNER") {
    return { xato: "Direktor rolini faqat direktor bera oladi", status: 403 };
  }
  // O'z rolini o'zgartirish taqiq.
  if (ozini && ozgarish.rol !== undefined && ozgarish.rol !== target.rol) {
    return { xato: "O'z rolingizni o'zgartira olmaysiz", status: 400 };
  }
  // O'zini nofaollashtirish taqiq (o'chirishdagi bilan bir xil qoida).
  if (ozini && ozgarish.isActive === false) {
    return { xato: "O'zingizni nofaollashtira olmaysiz", status: 400 };
  }
  // Oxirgi faol direktor himoyasi: rolini tushirish/nofaollashtirish mumkin emas.
  const direktorlikdanKetadi =
    target.rol === "OWNER" &&
    target.isActive &&
    ((ozgarish.rol !== undefined && ozgarish.rol !== "OWNER") || ozgarish.isActive === false);
  if (direktorlikdanKetadi && params.faolOwnerSoni <= 1) {
    return { xato: "Kompaniyada kamida bitta faol direktor qolishi kerak", status: 400 };
  }

  return null;
}

/** DELETE /api/users/[id] uchun tekshiruv. `null` — ruxsat. */
export function userOchirishniTekshir(params: {
  aktor: { userId: string; rol: Rol };
  target: { id: string; rol: Rol; isActive: boolean };
  faolOwnerSoni: number;
}): UserPolicyXato | null {
  const { aktor, target } = params;
  if (target.id === aktor.userId) {
    return { xato: "O'zingizni o'chira olmaysiz", status: 400 };
  }
  if (target.rol === "OWNER") {
    if (aktor.rol !== "OWNER") {
      return { xato: "Direktor hisobini faqat boshqa direktor o'chirishi mumkin", status: 403 };
    }
    if (target.isActive && params.faolOwnerSoni <= 1) {
      return { xato: "Kompaniyada kamida bitta faol direktor qolishi kerak", status: 400 };
    }
  }
  return null;
}

/** POST /api/users uchun tekshiruv. `null` — ruxsat. */
export function userYaratishniTekshir(params: {
  aktorRol: Rol;
  yangiRol: Rol;
}): UserPolicyXato | null {
  if (params.yangiRol === "OWNER" && params.aktorRol !== "OWNER") {
    return { xato: "Direktor hisobini faqat direktor yarata oladi", status: 403 };
  }
  return null;
}
