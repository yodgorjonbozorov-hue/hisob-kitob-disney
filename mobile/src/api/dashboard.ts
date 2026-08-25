import { apiFetch, qs } from './client';
import type {
  AccountQoldiqDTO,
  CategoryBreakdownItem,
  KunlikHisobotResponse,
  MonthSummary,
} from './types';

// Faqat OWNER/ADMIN — boshqa rollar uchun backend 403 qaytaradi
export function fetchMonthSummary(month?: string): Promise<MonthSummary> {
  return apiFetch<MonthSummary>(`/api/dashboard/summary${qs({ month })}`);
}

export function fetchCategoryBreakdown(
  turi: 'kirim' | 'chiqim',
  month?: string
): Promise<CategoryBreakdownItem[]> {
  return apiFetch<CategoryBreakdownItem[]>(
    `/api/dashboard/category-breakdown${qs({ month, turi })}`
  );
}

// Faqat menejer (qoldiq bilan)
export function fetchAccountBalances(): Promise<AccountQoldiqDTO[]> {
  return apiFetch<AccountQoldiqDTO[]>('/api/accounts?qoldiq=1');
}

export function fetchKunlikHisobot(sana?: string): Promise<KunlikHisobotResponse> {
  return apiFetch<KunlikHisobotResponse>(`/api/kunlik/hisobot${qs({ sana })}`);
}
