import { apiFetch, qs } from './client';

export type QarzHolat = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type QarzTolovUsuli = 'naqd' | 'click' | 'bank';

// Shaxs kesimidagi qarzdor (1 mijoz = 1 qator) — GET /api/debts/qarzdorlar
export interface QarzdorDTO {
  kalit: string;
  contactId: string | null;
  ism: string;
  tel: string | null;
  turi: string;
  qarz: number;
  jamiBerilgan: number;
  jamiTolangan: number;
  ochiqSoni: number;
  oxirgiTolov: string | null;
  oxirgiTolovSumma: number | null;
  eskiSana: string;
  eskiKun: number;
  muddatOtdi: boolean;
  muddatiOtganSumma: number;
  yaqinMuddat: string | null;
  status: QarzHolat;
}

export interface QarzdorTafsilotDTO {
  kalit: string;
  contactId: string | null;
  ism: string;
  tel: string | null;
  turi: string;
  jamiQarz: number;
  jamiBerilgan: number;
  jamiTolangan: number;
  ochiqQarzlar: {
    id: string;
    jamiSumma: number;
    tolangan: number;
    qolgan: number;
    sana: string | null;
    muddat: string | null;
    status: QarzHolat;
    izoh: string | null;
    muddatOtdi: boolean;
  }[];
  hodisalar: {
    id: string;
    turi: 'qarz' | 'tolov';
    sana: string | null;
    summa: number;
    izoh: string | null;
    debtId: string;
    tafsil: string | null;
  }[];
}

export interface QarzDashboardDTO {
  ochiqJami: number;
  bugunBerilgan: number;
  bugunYopilgan: number;
  muddatiOtgan: number;
  mijozlarSoni: number;
  muddatiOtganSoni: number;
  beriladiganJami: number;
  beriladiganSoni: number;
}

export interface CreateQarzInput {
  turi?: 'olinadigan' | 'beriladigan';
  contactId?: string | null;
  mijozNomi?: string | null;
  mijozTel?: string | null;
  jamiSumma: number;
  sana?: string | null;
  muddat?: string | null;
  izoh?: string | null;
  categoryId?: string | null;
}

export function fetchQarzdorlar(params?: {
  turi?: string;
  q?: string;
}): Promise<QarzdorDTO[]> {
  return apiFetch<QarzdorDTO[]>(`/api/debts/qarzdorlar${qs({ turi: params?.turi, q: params?.q })}`);
}

export function fetchQarzDashboard(): Promise<{ items: unknown[]; dashboard: QarzDashboardDTO | null }> {
  return apiFetch(`/api/debts`);
}

export function fetchQarzdorTafsilot(kalit: string, turi: string): Promise<QarzdorTafsilotDTO> {
  return apiFetch<QarzdorTafsilotDTO>(`/api/debts/qarzdor${qs({ kalit, turi })}`);
}

export function createQarz(input: CreateQarzInput): Promise<{ id: string }> {
  return apiFetch(`/api/debts`, { method: 'POST', body: input });
}

// Bir summa — shaxsning ochiq qarzlariga (eng eskisidan boshlab) taqsimlanadi.
// idempotencyKey takroriy bosishda dublikat to'lovni oldini oladi.
export function qarzdorTolov(input: {
  turi: 'olinadigan' | 'beriladigan';
  kalit: string;
  summa: number;
  tolovTuri?: QarzTolovUsuli;
  izoh?: string;
  idempotencyKey: string;
}): Promise<{ summa: number; qolgan: number; yopilganSoni: number; yangiTolov: boolean }> {
  return apiFetch(`/api/debts/qarzdor/tolov`, { method: 'POST', body: input });
}
