import { kategoriyaGuruhla, sanaGuruhla, tolovYorligi } from '../src/utils/guruhlash';
import type { TransactionDTO } from '../src/api/types';

function yozuv(qisman: Partial<TransactionDTO>): TransactionDTO {
  return {
    id: Math.random().toString(36).slice(2),
    turi: 'kirim',
    categoryId: 'kat1',
    category: { id: 'kat1', nomi: 'Gul', turi: 'kirim', tartib: 0, isActive: true, kgAsosli: false },
    accountId: null,
    account: null,
    tolovTuri: 'naqd',
    summa: 100000,
    miqdorGr: null,
    kgNarxi: null,
    sana: '2026-08-25T00:00:00.000Z',
    izoh: null,
    userId: 'u1',
    user: { id: 'u1', ism: 'Anvar' },
    createdAt: '2026-08-25T10:00:00.000Z',
    ...qisman,
  };
}

describe('kategoriyaGuruhla', () => {
  it('kategoriya bo‘yicha jamlaydi va kamayish tartibida beradi', () => {
    const items = [
      yozuv({ categoryId: 'gul', category: { id: 'gul', nomi: 'Gul', turi: 'kirim', tartib: 0, isActive: true, kgAsosli: false }, summa: 100000 }),
      yozuv({ categoryId: 'gul', category: { id: 'gul', nomi: 'Gul', turi: 'kirim', tartib: 0, isActive: true, kgAsosli: false }, summa: 50000 }),
      yozuv({ categoryId: 'dekor', category: { id: 'dekor', nomi: 'Onajon dekor', turi: 'kirim', tartib: 0, isActive: true, kgAsosli: false }, summa: 400000 }),
    ];
    const guruhlar = kategoriyaGuruhla(items);
    expect(guruhlar).toHaveLength(2);
    expect(guruhlar[0]).toMatchObject({ categoryId: 'dekor', jami: 400000, soni: 1 });
    expect(guruhlar[1]).toMatchObject({ categoryId: 'gul', jami: 150000, soni: 2 });
  });

  it('kirim va chiqim kategoriyalari alohida qoladi', () => {
    const items = [
      yozuv({ categoryId: 'a', turi: 'kirim' }),
      yozuv({ categoryId: 'b', turi: 'chiqim' }),
    ];
    const guruhlar = kategoriyaGuruhla(items);
    expect(guruhlar.find((g) => g.categoryId === 'a')?.turi).toBe('kirim');
    expect(guruhlar.find((g) => g.categoryId === 'b')?.turi).toBe('chiqim');
  });

  it("bo'sh ro'yxat — bo'sh natija", () => {
    expect(kategoriyaGuruhla([])).toEqual([]);
  });
});

describe('sanaGuruhla', () => {
  it('kun bo‘yicha bo‘limlar, yangi birinchi', () => {
    const items = [
      yozuv({ sana: '2026-08-20T00:00:00.000Z', summa: 10000 }),
      yozuv({ sana: '2026-08-22T00:00:00.000Z', summa: 20000 }),
      yozuv({ sana: '2026-08-22T00:00:00.000Z', summa: 5000, turi: 'chiqim' }),
    ];
    const bolimlar = sanaGuruhla(items);
    expect(bolimlar).toHaveLength(2);
    expect(bolimlar[0].sana).toBe('2026-08-22');
    expect(bolimlar[0].jami).toBe(15000); // 20000 kirim - 5000 chiqim
    expect(bolimlar[1].sana).toBe('2026-08-20');
  });
});

describe('tolovYorligi', () => {
  it("to'lov turini to'g'ri aniqlaydi", () => {
    expect(tolovYorligi({ tolovTuri: 'qarz', account: null })).toBe('Qarz');
    expect(tolovYorligi({ tolovTuri: 'naqd', account: null })).toBe('Naqd');
    expect(tolovYorligi({ tolovTuri: 'click', account: null })).toBe('Click');
    // Eski yozuvlar: tolovTuri null — kassa turidan chiqariladi
    expect(
      tolovYorligi({ tolovTuri: null, account: { id: 'a', nomi: 'Karta', turi: 'plastik' } })
    ).toBe('Karta');
    expect(
      tolovYorligi({ tolovTuri: null, account: { id: 'a', nomi: 'Bank', turi: 'bank' } })
    ).toBe('Hisob');
    expect(tolovYorligi({ tolovTuri: null, account: null })).toBe('Naqd');
  });
});
