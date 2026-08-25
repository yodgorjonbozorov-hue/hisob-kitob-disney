// Sana utilitalari — backend bilan kelishuv: "YYYY-MM-DD" string.
// Mahalliy (qurilma) vaqt zonasida hisoblanadi, ko'rsatish ham mahalliy.

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function bugun(): string {
  return toDateString(new Date());
}

export function kecha(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}

// Dushanbadan boshlanadigan hafta boshi
export function haftaBoshi(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = yakshanba
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return toDateString(d);
}

export function oyBoshi(): string {
  const d = new Date();
  d.setDate(1);
  return toDateString(d);
}

const OYLAR = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

// "2026-08-25" -> "25-avgust" yoki boshqa yil bo'lsa "25-avgust 2025"
export function formatSana(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const label = `${d}-${OYLAR[m - 1] ?? ''}`;
  const now = new Date();
  return y === now.getFullYear() ? label : `${label} ${y}`;
}

// Guruh sarlavhasi: Bugun / Kecha / "25-avgust"
export function sanaGuruhi(dateStr: string): string {
  const key = dateStr.slice(0, 10);
  if (key === bugun()) return 'Bugun';
  if (key === kecha()) return 'Kecha';
  return formatSana(key);
}

// ISO timestamp -> "YYYY-MM-DD" (mahalliy emas — backend UTC-midnight saqlaydi,
// shu sabab UTC bo'yicha kesamiz, aks holda sana bir kunga suriladi)
export function isoToDateString(iso: string): string {
  return iso.slice(0, 10);
}
