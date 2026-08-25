// Backend javob modellari — src/app/api/* dagi haqiqiy shakllar asosida.
// Pul har doim Int (so'm). Sana "YYYY-MM-DD" yoki ISO string.

export type Rol = 'SUPERADMIN' | 'OWNER' | 'ADMIN' | 'CASHIER' | 'SELLER';

export type TranTuri = 'kirim' | 'chiqim';
export type TolovTuri = 'naqd' | 'click' | 'qarz';
export type TolovGuruhi = 'naqd' | 'click' | 'karta' | 'qarz';
export type AccountTuri = 'naqd' | 'plastik' | 'bank';

export interface LoginResponse {
  ok: true;
  rol: Rol;
  mustChangePassword: boolean;
  token?: string; // mobil klient uchun (x-balansa-client: mobile)
}

export interface MeResponse {
  userId: string;
  ism: string;
  login: string;
  rol: Rol;
  tenantId: string | null;
  businessId: string | null;
  mustChangePassword: boolean;
  tenant: { id: string; name: string; plan: string; status: string } | null;
  access: { mode: 'FULL' | 'READONLY' | 'BILLING_ONLY'; sabab?: string } | null;
  businesses: BusinessDTO[];
  activeBusinessId: string | null;
  modullar: string[]; // yoqilgan modul kodlari
  ruxsatlar: string[]; // granular ruxsat kalitlari
}

export interface BusinessDTO {
  id: string;
  nomi: string;
  isActive: boolean;
  omborli: boolean;
  turi: string | null;
  shaxsiyKassa: boolean;
  magazin: boolean;
}

export interface CategoryDTO {
  id: string;
  nomi: string;
  turi: TranTuri;
  tartib: number;
  isActive: boolean;
  kgAsosli: boolean;
  oxirgiKgNarxi?: number | null;
}

export interface TransactionDTO {
  id: string;
  turi: TranTuri;
  categoryId: string;
  category: CategoryDTO | null;
  accountId: string | null;
  account: { id: string; nomi: string; turi: AccountTuri } | null;
  tolovTuri: TolovTuri | null;
  summa: number;
  miqdorGr: number | null;
  kgNarxi: number | null;
  sana: string; // ISO
  izoh: string | null;
  userId: string;
  user: { id: string; ism: string } | null;
  crmBuyurtma?: { id: string; nomi: string } | null;
  createdAt: string;
}

export interface TransactionTotals {
  jamiKirim: number;
  jamiChiqim: number;
  sof: number;
  naqdKirim: number;
  clickKirim: number;
  qarzKirim: number;
}

export interface TransactionsResponse {
  items: TransactionDTO[];
  total: number;
  page: number;
  pageSize: number;
  totals?: TransactionTotals;
  kunlik?: { sana: string; summa: number; soni: number }[] | null;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  turi?: TranTuri;
  categoryId?: string;
  q?: string;
  tolov?: TolovGuruhi;
  xodimId?: string;
  minSumma?: number;
  maxSumma?: number;
  page?: number;
  pageSize?: number;
}

export interface CreateTransactionInput {
  turi: TranTuri;
  categoryId: string;
  summa: number;
  sana: string; // YYYY-MM-DD
  accountId?: string | null;
  tolovTuri?: TolovTuri | null;
  izoh?: string | null;
  miqdorKg?: number | null;
  kgNarxi?: number | null;
}

// 202 — tasdiqlash kutilmoqda (TASDIQLASH moduli)
export interface ApprovalPendingResponse {
  tasdiqKutilmoqda: true;
  message: string;
}

export interface AccountDTO {
  id: string;
  nomi: string;
  turi: AccountTuri;
  isActive: boolean;
  tartib: number;
  userId: string | null;
  egaIsm: string | null;
}

export interface AccountQoldiqDTO extends AccountDTO {
  kirim: number;
  chiqim: number;
  kirganTransfer: number;
  chiqqanTransfer: number;
  qoldiq: number;
}

export interface MonthSummary {
  month: string;
  jamiKirim: number;
  jamiChiqim: number;
  sofFoyda: number;
  prevMonth: { jamiKirim: number; jamiChiqim: number; sofFoyda: number };
  changePct: { kirim: number | null; chiqim: number | null; sofFoyda: number | null };
}

export interface CategoryBreakdownItem {
  categoryId: string;
  nomi: string;
  summa: number;
  foiz: number;
}

export interface KunlikReportDTO {
  id: string | null;
  sana: string;
  holat: 'OPEN' | 'SUBMITTED' | 'CONFIRMED';
  naqdSumma: number;
  clickSumma: number;
  qarzSumma: number;
  jamiSumma: number;
  chiqimSumma: number;
  sofSumma: number;
  submittedByIsm: string | null;
  submittedAt: string | null;
  sanalganNaqd: number | null;
  naqdFarq: number | null;
  confirmedByIsm: string | null;
  confirmedAt: string | null;
  items: {
    id: string;
    summa: number;
    tolovTuri: 'CASH' | 'CLICK' | 'DEBT';
    izoh: string | null;
    userId: string;
    userIsm: string;
    yozuvdan: boolean;
    createdAt: string;
  }[];
}

export interface KunlikHisobotResponse {
  report: KunlikReportDTO;
  ruxsat: {
    direktormi: boolean;
    boshqaruvchimi: boolean;
    tasdiqlaydi: boolean;
    tahrirlaydi: boolean;
    tarixniKoradi: boolean;
  };
  bugun: string;
}
