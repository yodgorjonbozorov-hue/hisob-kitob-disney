// Kirim/Chiqim ekrani filtr modeli — API parametrlariga sof aylantirish (testlanadi)
import type { TolovGuruhi, TranTuri, TransactionFilters } from '../../api/types';
import { bugun, haftaBoshi, oyBoshi } from '../../utils/sana';

export type Davr = 'bugun' | 'hafta' | 'oy';

export interface KcFiltr {
  davr: Davr;
  turi?: TranTuri;
  tolov?: TolovGuruhi;
  q: string;
  minSumma?: number;
  maxSumma?: number;
  xodimId?: string;
}

export const BOSHLANGICH_FILTR: KcFiltr = { davr: 'oy', q: '' };

export function davrOraligi(davr: Davr): { from: string; to: string } {
  const to = bugun();
  if (davr === 'bugun') return { from: to, to };
  if (davr === 'hafta') return { from: haftaBoshi(), to };
  return { from: oyBoshi(), to };
}

export function filtrToApi(f: KcFiltr): Omit<TransactionFilters, 'page' | 'pageSize'> {
  const { from, to } = davrOraligi(f.davr);
  return {
    from,
    to,
    turi: f.turi,
    tolov: f.tolov,
    q: f.q.trim() || undefined,
    minSumma: f.minSumma,
    maxSumma: f.maxSumma,
    xodimId: f.xodimId,
  };
}

// Nechta qo'shimcha filtr faol (Filter tugmasidagi belgi uchun)
export function faolFiltrSoni(f: KcFiltr): number {
  let n = 0;
  if (f.turi) n += 1;
  if (f.tolov) n += 1;
  if (f.minSumma != null || f.maxSumma != null) n += 1;
  if (f.xodimId) n += 1;
  return n;
}
