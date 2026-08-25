// Balansa mobil dizayn tokenlari — yagona manba.
// Ranglar docs/BRAND.md dagi veb palitra bilan mos (teal brand, income/expense semantikasi).
// Dark-first: asosiy tema qorong'i, light tema keyin qo'shiladi.

export const palette = {
  // Brend shkalasi (mavzudan qat'i nazar bir xil)
  brand50: '#F0FDFA',
  brand100: '#CCFBF1',
  brand300: '#5EEAD4',
  brand500: '#14B8A6',
  brand600: '#0D9488',
  brand700: '#0F766E',
  brand800: '#115E59',
  brand900: '#134E4A',

  // Moliyaviy semantika — hech qachon brend teal bilan almashtirilmaydi
  income: '#22C55E',
  incomeDim: '#16A34A',
  expense: '#EF4444',
  expenseDim: '#DC2626',
  debt: '#F59E0B',
  debtDim: '#D97706',
  info: '#38BDF8',

  white: '#FFFFFF',
  black: '#000000',
};

export const darkColors = {
  // Sirtlar
  canvas: '#0B1220', // sahifa foni
  surface: '#111A2C', // karta foni
  surfaceRaised: '#18233A', // ko'tarilgan karta / sheet
  surfaceSunk: '#0D1526', // input foni
  line: '#1E2A44', // border
  lineStrong: '#2A3A5C',

  // Matn
  ink: '#F1F5F9',
  inkSoft: '#94A3B8',
  inkFaint: '#64748B',

  // Brend (dark rejimda ochroq teal)
  brand: '#2DD4BF',
  brandInk: '#5EEAD4',
  brandWash: '#134E4A',
  brandFg: '#04211D', // brend tugma ustidagi matn

  income: palette.income,
  incomeWash: 'rgba(34,197,94,0.12)',
  expense: palette.expense,
  expenseWash: 'rgba(239,68,68,0.12)',
  debt: palette.debt,
  debtWash: 'rgba(245,158,11,0.14)',
  info: palette.info,
  infoWash: 'rgba(56,189,248,0.12)',

  danger: '#F87171',
  overlay: 'rgba(2,6,17,0.6)',
  tabBar: 'rgba(13,20,36,0.98)',
};

export const lightColors: typeof darkColors = {
  canvas: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunk: '#ECF1F6',
  line: '#E2E8F0',
  lineStrong: '#CBD5E1',

  ink: '#0F172A',
  inkSoft: '#475569',
  inkFaint: '#64748B',

  brand: '#0F766E',
  brandInk: '#115E59',
  brandWash: '#CCFBF1',
  brandFg: '#FFFFFF',

  income: palette.incomeDim,
  incomeWash: '#DCFCE7',
  expense: palette.expenseDim,
  expenseWash: '#FEE2E2',
  debt: palette.debtDim,
  debtWash: '#FEF3C7',
  info: '#0EA5E9',
  infoWash: '#E0F2FE',

  danger: '#DC2626',
  overlay: 'rgba(15,23,42,0.45)',
  tabBar: 'rgba(255,255,255,0.98)',
};

export type ThemeColors = typeof darkColors;

// 4px grid
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Radius: input/tugma 10, karta 14, sheet/modal 20, pill 999 (DESIGN.md)
export const radius = {
  input: 10,
  button: 12,
  card: 16,
  sheet: 24,
  pill: 999,
} as const;

// Shkala: 12/13/15/17/20/26/34 — pul summalari tabular
export const fontSize = {
  caption: 12,
  small: 13,
  body: 15,
  bodyLarge: 17,
  title: 20,
  headline: 26,
  display: 34,
} as const;

export const motion = {
  fast: 120,
  sheet: 220,
  counter: 400,
} as const;
