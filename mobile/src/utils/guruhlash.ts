// Tranzaksiyalarni guruhlash — sof funksiyalar (test qilinadi).
// DIQQAT: bu faqat KO'RSATISH uchun jamlash; buxgalteriya jamlamalari
// backend'dan keladi (totals), bu yerda qayta hisoblanmaydi.
import type { TransactionDTO, TranTuri } from '../api/types';
import { isoToDateString, sanaGuruhi } from './sana';

export interface KategoriyaGuruh {
  categoryId: string;
  nomi: string;
  turi: TranTuri;
  jami: number;
  soni: number;
}

// Kategoriya kesimi: har kategoriya bo'yicha jami va yozuvlar soni.
// Tartib: jami bo'yicha kamayish.
export function kategoriyaGuruhla(items: TransactionDTO[]): KategoriyaGuruh[] {
  const map = new Map<string, KategoriyaGuruh>();
  for (const item of items) {
    const kalit = item.categoryId;
    const mavjud = map.get(kalit);
    if (mavjud) {
      mavjud.jami += item.summa;
      mavjud.soni += 1;
    } else {
      map.set(kalit, {
        categoryId: item.categoryId,
        nomi: item.category?.nomi ?? 'Nomsiz',
        turi: item.turi,
        jami: item.summa,
        soni: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.jami - a.jami);
}

export interface SanaBolim {
  title: string;
  sana: string;
  jami: number;
  data: TransactionDTO[];
}

// Sana kesimi: Bugun / Kecha / aniq sana bo'limlari (yangi birinchi)
export function sanaGuruhla(items: TransactionDTO[]): SanaBolim[] {
  const map = new Map<string, SanaBolim>();
  for (const item of items) {
    const kun = isoToDateString(item.sana);
    const mavjud = map.get(kun);
    if (mavjud) {
      mavjud.data.push(item);
      mavjud.jami += item.turi === 'kirim' ? item.summa : -item.summa;
    } else {
      map.set(kun, {
        title: sanaGuruhi(kun),
        sana: kun,
        jami: item.turi === 'kirim' ? item.summa : -item.summa,
        data: [item],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.sana < b.sana ? 1 : -1));
}

// To'lov turi yorlig'i — Transaction.tolovTuri null bo'lsa kassa turidan chiqariladi
// (backend'dagi amaldagiBolim qoidasi bilan mos)
export function tolovYorligi(item: Pick<TransactionDTO, 'tolovTuri' | 'account'>): string {
  if (item.tolovTuri === 'qarz') return 'Qarz';
  if (item.tolovTuri === 'naqd') return 'Naqd';
  if (item.tolovTuri === 'click') return 'Click';
  if (item.account?.turi === 'plastik') return 'Karta';
  if (item.account?.turi === 'bank') return 'Hisob';
  return 'Naqd';
}
