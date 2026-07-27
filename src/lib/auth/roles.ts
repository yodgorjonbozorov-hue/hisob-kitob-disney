/**
 * Rol tizimi (SaaS ierarxiyasi):
 * - SUPERADMIN — platforma egasi, tenantdan tashqarida (tenantId = null)
 * - OWNER     — tenant (mijoz kompaniya) egasi; avvalgi "admin"/direktor
 * - ADMIN     — tenant ichidagi boshqaruvchi (OWNER bilan bir xil huquq, FAZA 2+ da aniqlashtiriladi)
 * - CASHIER   — kassir, bitta biznesga biriktirilgan; avvalgi "kassir"
 * - SELLER    — sotuvchi, faqat kirim/chiqim kiritadi; avvalgi "sotuvchi"
 *
 * Bu modul client va server ikkalasida ishlatiladi — server-only import qo'shilmasin.
 */
export type Rol = "SUPERADMIN" | "OWNER" | "ADMIN" | "CASHIER" | "SELLER";

export const ROL_LABEL: Record<Rol, string> = {
  SUPERADMIN: "Super admin",
  OWNER: "Direktor",
  ADMIN: "Administrator",
  CASHIER: "Kassir",
  SELLER: "Sotuvchi",
};

/** Tenant boshqaruvchilari — Prisma `where: { rol: { in: ... } }` uchun. */
export const MANAGER_ROLLAR: Rol[] = ["OWNER", "ADMIN"];

/** Tenant boshqaruvchisimi (avvalgi `rol === "admin"` tekshiruvi o'rnida). */
export function isManager(rol: string | undefined | null): boolean {
  return rol === "OWNER" || rol === "ADMIN";
}

/**
 * Eski (migratsiyagacha bo'lgan) sessiya cookie'lari va bazadagi qiymatlarni
 * yangi rol nomlariga o'tkazadi. Yangi qiymatlar o'zgarishsiz qaytadi.
 */
export function normalizeRol(rol: string): Rol {
  switch (rol) {
    case "admin":
      return "OWNER";
    case "kassir":
      return "CASHIER";
    case "sotuvchi":
      return "SELLER";
    default:
      return rol as Rol;
  }
}
