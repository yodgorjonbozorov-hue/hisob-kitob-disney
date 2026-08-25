import { apiFetch, qs } from './client';
import type {
  ApprovalPendingResponse,
  CategoryDTO,
  CreateTransactionInput,
  TransactionDTO,
  TransactionFilters,
  TransactionsResponse,
  AccountDTO,
} from './types';

export function fetchTransactions(filters: TransactionFilters): Promise<TransactionsResponse> {
  return apiFetch<TransactionsResponse>(
    `/api/transactions${qs({
      from: filters.from,
      to: filters.to,
      turi: filters.turi,
      categoryId: filters.categoryId,
      q: filters.q,
      tolov: filters.tolov,
      xodimId: filters.xodimId,
      minSumma: filters.minSumma,
      maxSumma: filters.maxSumma,
      page: filters.page,
      pageSize: filters.pageSize,
    })}`
  );
}

// 201 — TransactionDTO, 202 — tasdiqlash kutilmoqda (TASDIQLASH moduli)
export function createTransaction(
  input: CreateTransactionInput
): Promise<TransactionDTO | ApprovalPendingResponse> {
  return apiFetch<TransactionDTO | ApprovalPendingResponse>('/api/transactions', {
    method: 'POST',
    body: input,
  });
}

export function deleteTransaction(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/transactions/${id}`, { method: 'DELETE' });
}

export function fetchCategories(turi?: 'kirim' | 'chiqim', activeOnly = true): Promise<CategoryDTO[]> {
  return apiFetch<CategoryDTO[]>(
    `/api/categories${qs({ turi, active: activeOnly ? 'true' : undefined })}`
  );
}

export function fetchAccounts(): Promise<AccountDTO[]> {
  return apiFetch<AccountDTO[]>('/api/accounts');
}

export function tasdiqKutilmoqda(
  natija: TransactionDTO | ApprovalPendingResponse
): natija is ApprovalPendingResponse {
  return (natija as ApprovalPendingResponse).tasdiqKutilmoqda === true;
}
