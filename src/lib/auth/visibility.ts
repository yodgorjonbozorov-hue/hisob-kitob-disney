import { isManager, type Rol } from "./roles";

/**
 * KIRIM/CHIQIM KO'RINUVCHANLIGI (bitta manba — barcha ro'yxat va jamlanmalar shu yerdan).
 *
 * - OWNER/ADMIN (direktor, administrator) — biznesdagi BARCHA yozuvlarni ko'radi;
 * - CASHIER/SELLER (xodim)                — faqat O'ZI kiritgan yozuvlarni ko'radi.
 *
 * Qaytadi: `null` — cheklov yo'q; `string` — faqat shu userId kiritgan yozuvlar.
 *
 * Eslatma: bu KO'RISH qoidasi. Tahrirlash/o'chirish huquqi alohida —
 * `requireOwnerOrAdmin` (lib/auth/guard.ts) bilan tekshiriladi.
 */
export function transactionScopeUserId(session: { rol: Rol; userId: string }): string | null {
  return isManager(session.rol) ? null : session.userId;
}
