import { apiFetch } from './client';
import type { TolovTuri } from './types';

export interface StageDTO {
  id: string;
  nomi: string;
  tartib: number;
  turi: 'OPEN' | 'WON' | 'LOST';
}

export interface DealDTO {
  id: string;
  nomi: string;
  summa: number;
  categoryId: string | null;
  category: { id: string; nomi: string } | null;
  stageId: string;
  contactId: string | null;
  contact: { id: string; ism: string; tel: string | null } | null;
  masulId: string;
  sana: string | null;
  muddat: string | null;
  yopilganAt: string | null;
  transactionId: string | null;
  izoh: string | null;
  createdAt: string;
}

export interface BoardResponse {
  stages: StageDTO[];
  deals: DealDTO[];
}

export interface CreateDealInput {
  nomi: string;
  categoryId: string;
  summa?: number;
  kontaktIsm?: string | null;
  kontaktTel?: string | null;
  sana?: string | null;
  izoh?: string | null;
  stageId?: string | null;
}

export function fetchBoard(): Promise<BoardResponse> {
  return apiFetch<BoardResponse>('/api/crm/board');
}

export function createDeal(input: CreateDealInput): Promise<DealDTO> {
  return apiFetch<DealDTO>('/api/crm/deals', { method: 'POST', body: input });
}

export function moveDeal(id: string, stageId: string, kirimYoz?: boolean): Promise<DealDTO> {
  return apiFetch<DealDTO>(`/api/crm/deals/${id}`, {
    method: 'PATCH',
    body: { stageId, ...(kirimYoz !== undefined ? { kirimYoz } : null) },
  });
}

// Buyurtmani Kirimga o'tkazish — dublikat himoyasi serverda (Deal.transactionId @unique)
export function dealToKirim(
  id: string,
  opts?: { tolovTuri?: TolovTuri | null; accountId?: string | null }
): Promise<{ transactionId: string; summa: number }> {
  return apiFetch<{ transactionId: string; summa: number }>(`/api/crm/deals/${id}/kirim`, {
    method: 'POST',
    body: opts ?? {},
  });
}
