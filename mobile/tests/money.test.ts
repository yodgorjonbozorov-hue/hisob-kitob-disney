import {
  formatSum,
  formatSom,
  formatCompact,
  formatAmountInput,
  parseAmountInput,
} from '../src/utils/money';

// Ko'rsatishda guruhlar NBSP ( ) bilan ajratiladi — satr o'rtasida uzilmasin
const B = '\u00A0';

describe('formatSum', () => {
  it('mingliklarni probel bilan ajratadi', () => {
    expect(formatSum(300000)).toBe(`300${B}000`);
    expect(formatSum(1250000)).toBe(`1${B}250${B}000`);
    expect(formatSum(0)).toBe('0');
    expect(formatSum(999)).toBe('999');
  });
  it('manfiy sonlarni saqlaydi', () => {
    expect(formatSum(-45000)).toBe(`-45${B}000`);
  });
  it('kasr qismini tashlaydi (pul Int)', () => {
    expect(formatSum(1000.9)).toBe(`1${B}000`);
  });
});

describe('formatSom', () => {
  it("so'm qo'shadi", () => {
    expect(formatSom(300000)).toBe(`300${B}000${B}so'm`);
  });
});

describe('formatCompact', () => {
  it('mln ko‘rinishi', () => {
    expect(formatCompact(4900000)).toBe('4,9 mln');
    expect(formatCompact(12000000)).toBe('12 mln');
  });
  it('ming ko‘rinishi', () => {
    expect(formatCompact(320000)).toBe('320 ming');
  });
  it('kichik sonlar to‘liq', () => {
    expect(formatCompact(45000)).toBe(`45${B}000`);
  });
  it('mlrd', () => {
    expect(formatCompact(2500000000)).toBe('2,5 mlrd');
  });
});

describe('formatAmountInput / parseAmountInput', () => {
  it('kiritishni formatlaydi', () => {
    expect(formatAmountInput('1250000')).toBe('1 250 000');
    expect(formatAmountInput('12a50')).toBe('1 250');
    expect(formatAmountInput('007')).toBe('7');
    expect(formatAmountInput('')).toBe('');
  });
  it('parse butun son qaytaradi', () => {
    expect(parseAmountInput('1 250 000')).toBe(1250000);
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('0')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
  });
});
