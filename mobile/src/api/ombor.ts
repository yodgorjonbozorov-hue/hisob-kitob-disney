import { apiFetch, qs } from './client';

export interface OmborMahsulotDTO {
  id: string;
  nomi: string;
  rasmUrl: string | null;
  categoryId: string | null;
  kategoriyaNomi: string | null;
  birlik: string;
  miqdor: number;
  minQoldiq: number;
  kelganNarx: number;
  sotuvNarx: number;
  sku: string | null;
  isActive: boolean;
  holat: string;
  qiymat: number;
}

export interface OmborRoyxatDTO {
  mahsulotlar: OmborMahsulotDTO[];
  jami: number;
  sahifa: number;
  limit: number;
  yanaBor: boolean;
}

export interface HarakatDTO {
  id: string;
  turi: string;
  farq: number;
  birlikNarx: number | null;
  izoh: string | null;
  sana: string;
}

export interface MahsulotDetalDTO extends OmborMahsulotDTO {
  barcode: string | null;
  izoh: string | null;
  harakatlar: HarakatDTO[];
}

export interface OmborKpiDTO {
  turlarSoni: number;
  birliklar: { birlik: string; miqdor: number; turlar: number; qiymat: number }[];
  asosiy: { birlik: string; miqdor: number; turlar: number; qiymat: number } | null;
  omborQiymati: number;
  kamQolgan: number;
  tugagan: number;
}

// Menejer uchun sahifalangan ro'yxat (qidiruv serverda)
export function fetchOmborMahsulotlar(params: {
  q?: string;
  categoryId?: string;
  holat?: 'barchasi' | 'kam' | 'tugagan';
  sahifa?: number;
  limit?: number;
}): Promise<OmborRoyxatDTO> {
  return apiFetch<OmborRoyxatDTO>(`/api/ombor/mahsulotlar${qs(params)}`);
}

export function fetchMahsulotDetal(id: string): Promise<MahsulotDetalDTO> {
  return apiFetch<MahsulotDetalDTO>(`/api/ombor/mahsulotlar/${id}`);
}

export function fetchOmborKpi(): Promise<OmborKpiDTO> {
  return apiFetch<OmborKpiDTO>('/api/ombor/kpi');
}

// Kassir/sotuvchi ko'rinishi — narx bor, miqdor RAQAMI yo'q (backend shakllantiradi)
export interface ProductKassirDTO {
  id: string;
  nomi: string;
  sotuvNarx: number;
  mavjud: boolean;
  birlik: string;
  sku: string | null;
}

export function fetchProductsKassir(): Promise<ProductKassirDTO[]> {
  return apiFetch<ProductKassirDTO[]>('/api/products?active=true');
}
