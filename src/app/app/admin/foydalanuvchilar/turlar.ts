/** Foydalanuvchilar sahifasining umumiy turlari (sahifa, jadval va modallar shundan oladi). */

export interface BusinessOption {
  id: string;
  nomi: string;
}

export interface RoleOption {
  id: string;
  nomi: string;
}

export const ROL_LABEL: Record<string, string> = {
  OWNER: "Direktor",
  ADMIN: "Administrator",
  CASHIER: "Kassir",
  SELLER: "Sotuvchi",
};

export interface UserDTO {
  id: string;
  ism: string;
  login: string;
  rol: string;
  isActive: boolean;
  createdAt: string;
  /** Birlamchi biznes — AYNAN bitta biznesga biriktirilgan bo'lsa (aks holda null). */
  businessId: string | null;
  businessNomi: string | null;
  /**
   * KO'P-BIZNESLIK: xodim biriktirilgan barcha bizneslar. Bo'sh massiv —
   * cheklov yo'q (barcha bizneslar).
   */
  businessIds: string[];
  /** Maxsus rol (PRO) — tayinlangan bo'lsa rol select "custom:<id>" ko'rsatadi. */
  roleId: string | null;
  rolNomi: string | null;
  /** Shaxsiy kassalari qoldig'i (ledger'dan, joriy biznes). */
  balans: number;
  /** Ta'minotchi sifatida ochiq qarz (biznes shu odamga qarzdor). */
  qarz: number;
  /** Pul harakatlari soni: tranzaksiyalar + o'tkazmalar. */
  amallar: number;
}
