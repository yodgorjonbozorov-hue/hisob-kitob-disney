import { davrOraligi, filtrToApi, faolFiltrSoni, BOSHLANGICH_FILTR } from '../src/features/kirimChiqim/filtrlar';
import { bugun, oyBoshi, haftaBoshi } from '../src/utils/sana';

describe('davrOraligi', () => {
  it('bugun — from=to=bugun', () => {
    const { from, to } = davrOraligi('bugun');
    expect(from).toBe(bugun());
    expect(to).toBe(bugun());
  });
  it('oy — oy boshidan bugungacha', () => {
    const { from, to } = davrOraligi('oy');
    expect(from).toBe(oyBoshi());
    expect(to).toBe(bugun());
  });
  it('hafta — dushanbadan bugungacha', () => {
    const { from } = davrOraligi('hafta');
    expect(from).toBe(haftaBoshi());
  });
});

describe('filtrToApi', () => {
  it('filtrlar birga ishlaydi: davr + kategoriya turi + qidiruv', () => {
    const api = filtrToApi({ davr: 'oy', turi: 'kirim', q: ' gul ', tolov: 'naqd', minSumma: 1000 });
    expect(api.from).toBe(oyBoshi());
    expect(api.turi).toBe('kirim');
    expect(api.q).toBe('gul');
    expect(api.tolov).toBe('naqd');
    expect(api.minSumma).toBe(1000);
  });
  it("bo'sh qidiruv undefined bo'ladi", () => {
    expect(filtrToApi({ davr: 'bugun', q: '  ' }).q).toBeUndefined();
  });
});

describe('faolFiltrSoni', () => {
  it('boshlang‘ich holatda 0', () => {
    expect(faolFiltrSoni(BOSHLANGICH_FILTR)).toBe(0);
  });
  it('har filtr sanaladi', () => {
    expect(
      faolFiltrSoni({ davr: 'oy', q: '', turi: 'kirim', tolov: 'qarz', minSumma: 5, xodimId: 'u' })
    ).toBe(4);
  });
});
