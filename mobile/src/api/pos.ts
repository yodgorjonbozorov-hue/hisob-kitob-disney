import { apiFetch } from './client';

export type PosTolovTuri = 'naqd' | 'karta' | 'click' | 'qarz';

export interface PosLookupNatija {
  topildi: boolean;
  mahsulot?: {
    id: string;
    nomi: string;
    sotuvNarx: number;
    miqdor: number;
    birlik: string;
    barcode: string | null;
    manba: 'barcode' | 'qr' | 'sku';
  };
}

export interface PosChekNatija {
  id: string;
  raqam: number;
  jamiSumma: number;
  tolovTuri: string;
  satrlar: { nomi: string; miqdor: number; birlikNarx: number; jamiSumma: number }[];
}

export interface PosChekDTO {
  id: string;
  raqam: number;
  jamiSumma: number;
  tolovTuri: string;
  mijozNomi: string | null;
  sana: string;
  createdAt: string;
  bekorQilingan: boolean;
  cancelReason: string | null;
  kassir: string;
  satrlar: { nomi: string; miqdor: number; birlikNarx: number; jamiSumma: number }[];
}

// POST — kod URL/loglarga tushmasligi uchun
export function posLookup(kod: string): Promise<PosLookupNatija> {
  return apiFetch<PosLookupNatija>('/api/pos/lookup', { method: 'POST', body: { kod } });
}

export function posSotuv(input: {
  satrlar: { productId: string; miqdor: number; narx?: number | null }[];
  tolovTuri: PosTolovTuri;
  mijozNomi?: string;
  mijozTel?: string;
}): Promise<PosChekNatija> {
  return apiFetch<PosChekNatija>('/api/pos/chek', { method: 'POST', body: input });
}

export function fetchPosCheklar(): Promise<PosChekDTO[]> {
  return apiFetch<PosChekDTO[]>('/api/pos/chek');
}

// Qaytarish — faqat menejer
export function posChekBekor(id: string, sabab: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/pos/chek/${id}/bekor`, { method: 'POST', body: { sabab } });
}
