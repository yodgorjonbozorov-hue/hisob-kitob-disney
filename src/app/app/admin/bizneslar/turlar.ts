import { formatRelativeDay, formatToshkentSoat } from "@/lib/format";

/** Bizneslar sahifasining umumiy tiplari (client, jadval va wizard orasida). */
export interface BusinessDTO {
  id: string;
  nomi: string;
  isActive: boolean;
  /** "umumiy" | "avto" — ombor moduli qaysi rejimda ishlaydi (lib/biznesTuri.ts). */
  turi: string;
  /** Ombor va sotuv shu bizneste yuritiladimi (nav'da Ombor/Sotuv shunga bog'liq). */
  omborli: boolean;
  /** Do'kon kassasi (POS) shu bizneste yuritiladimi (nav'da Kassa shunga bog'liq). */
  magazin: boolean;
  shaxsiyKassa: boolean;
  createdAt: string;
  kategoriyalar: number;
  tranzaksiyalar: number;
  xodimlar: number;
  /** Oxirgi real faollik (ISO) yoki null — soxta qiymat qo'yilmaydi. */
  oxirgiFaollik: string | null;
  /** Shu bizneste ishlaydigan modullarning qisqa nomlari (lib/modules/biznesModullari.ts). */
  modullar: string[];
}

/** Yangi biznes yaratilganda API qaytaradigan minimal shakl. */
export interface YangiBiznes {
  id: string;
  nomi: string;
  isActive: boolean;
  turi: string;
  omborli: boolean;
  magazin: boolean;
  shaxsiyKassa?: boolean;
  createdAt?: string;
}

export type Filtr = "hammasi" | "faol" | "nofaol";
export type Saralash = "faollik" | "yangi" | "tranzaksiya" | "nom";

export const SARALASH_NOMLARI: { kod: Saralash; nomi: string }[] = [
  { kod: "faollik", nomi: "Oxirgi faol" },
  { kod: "yangi", nomi: "Yangi qo'shilgan" },
  { kod: "tranzaksiya", nomi: "Eng ko'p tranzaksiya" },
  { kod: "nom", nomi: "Nomi A–Z" },
];

/**
 * OXIRGI FAOLLIK MATNI — "Bugun, 13:32" / "Kecha, 09:10" / "24 iyul".
 * Ma'lumot bo'lmasa "—": bu yerda hech qachon taxminiy sana chiqmaydi.
 */
export function faollikMatn(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const kun = formatRelativeDay(d, now);
  return kun === "Bugun" || kun === "Kecha" ? `${kun}, ${formatToshkentSoat(d)}` : kun;
}

/** Raqamni bo'shliq bilan ajratib ko'rsatadi ("1 007"). */
export function son(n: number): string {
  return n.toLocaleString("ru-RU").replace(/ /g, " ");
}

function vaqt(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * QIDIRUV + FILTR + SARALASH — sof funksiya (testdan chaqiriladi).
 *
 * Qidiruv biznes nomi bo'yicha, registrga sezgir emas. Ro'yxat tenantning
 * BARCHA bizneslari (server bir marta agregatsiya bilan yuklaydi), shuning
 * uchun 500 tagacha bizneste ham bu amal bir renderda tugaydi va har
 * bosishda serverga so'rov ketmaydi.
 */
export function royxatniTayyorla(
  bizneslar: BusinessDTO[],
  { qidiruv, filtr, saralash }: { qidiruv: string; filtr: Filtr; saralash: Saralash }
): BusinessDTO[] {
  const q = qidiruv.trim().toLocaleLowerCase("uz");
  const natija = bizneslar.filter((b) => {
    if (filtr === "faol" && !b.isActive) return false;
    if (filtr === "nofaol" && b.isActive) return false;
    if (q && !b.nomi.toLocaleLowerCase("uz").includes(q)) return false;
    return true;
  });

  const solishtir: Record<Saralash, (a: BusinessDTO, b: BusinessDTO) => number> = {
    // Faollik yo'q bizneslar oxirida qoladi (vaqt 0).
    faollik: (a, b) => vaqt(b.oxirgiFaollik) - vaqt(a.oxirgiFaollik) || a.nomi.localeCompare(b.nomi),
    yangi: (a, b) => vaqt(b.createdAt) - vaqt(a.createdAt) || a.nomi.localeCompare(b.nomi),
    tranzaksiya: (a, b) => b.tranzaksiyalar - a.tranzaksiyalar || a.nomi.localeCompare(b.nomi),
    nom: (a, b) => a.nomi.localeCompare(b.nomi),
  };
  return natija.sort(solishtir[saralash]);
}
