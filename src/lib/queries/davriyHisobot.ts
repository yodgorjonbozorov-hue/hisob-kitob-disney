import { getDailyDynamics, getTrend, type DailyPoint, type TrendPoint } from "@/lib/queries/dashboard";
import { dateOnlyStringToUTCDate, utcDateToDateOnlyString, monthRangeUTC } from "@/lib/date";

/**
 * DAVRIY HISOBOTLAR — "Hisobotlar" sahifasidagi Kunlik / Haftalik / Yillik
 * tablari uchun.
 *
 * YANGI BIZNES MANTIQI YO'Q. Barcha raqamlar MAVJUD so'rovlardan olinadi:
 *   kunlik  — `getDailyDynamics` (kun bo'yicha GROUP BY);
 *   haftalik— o'sha kunlik nuqtalar dushanbadan boshlanadigan haftalarga
 *             yig'iladi (sof JS, qo'shimcha so'rov yo'q);
 *   yillik  — `getTrend` (oy bo'yicha GROUP BY).
 * Shu bois tablardagi jami har doim oylik hisobot bilan mos tushadi:
 * ikkalasi ham bitta filtr (deletedAt null + qarzga yozilgani chiqarilgan)
 * bilan hisoblangan.
 */

export type Davr = "kunlik" | "haftalik" | "oylik" | "yillik";

export const DAVRLAR: { kod: Davr; yorliq: string }[] = [
  { kod: "kunlik", yorliq: "Kunlik" },
  { kod: "haftalik", yorliq: "Haftalik" },
  { kod: "oylik", yorliq: "Oylik" },
  { kod: "yillik", yorliq: "Yillik" },
];

/** Noma'lum qiymat kelsa (qo'lda yozilgan URL) — oylik. */
export function davrniOqi(xom: string | undefined): Davr {
  return DAVRLAR.some((d) => d.kod === xom) ? (xom as Davr) : "oylik";
}

export interface DavrQatori {
  /** Qator kaliti (kun uchun "YYYY-MM-DD", oy uchun "YYYY-MM"). */
  kalit: string;
  /** Ekrandagi yorliq ("5-avgust", "5–11 avgust", "Avgust"). */
  yorliq: string;
  kirim: number;
  chiqim: number;
  /** kirim − chiqim */
  sof: number;
}

export interface DavriyHisobot {
  davr: Davr;
  /** Sarlavha ostidagi izoh ("Avgust 2026", "2026-yil"). */
  sarlavha: string;
  qatorlar: DavrQatori[];
  jamiKirim: number;
  jamiChiqim: number;
  jamiSof: number;
}

const KUN_MS = 24 * 60 * 60 * 1000;
const OYLAR = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

function jamla(qatorlar: DavrQatori[]): Pick<DavriyHisobot, "jamiKirim" | "jamiChiqim" | "jamiSof"> {
  const jamiKirim = qatorlar.reduce((a, q) => a + q.kirim, 0);
  const jamiChiqim = qatorlar.reduce((a, q) => a + q.chiqim, 0);
  return { jamiKirim, jamiChiqim, jamiSof: jamiKirim - jamiChiqim };
}

function kunYorliq(kalit: string): string {
  const d = dateOnlyStringToUTCDate(kalit);
  return `${d.getUTCDate()}-${OYLAR[d.getUTCMonth()].toLowerCase()}`;
}

/** Kun tegishli haftaning DUSHANBASI ("YYYY-MM-DD"). */
function haftaBoshi(kalit: string): string {
  const d = dateOnlyStringToUTCDate(kalit);
  // getUTCDay(): yakshanba = 0 -> u haftaning 7-kuni deb hisoblanadi.
  const kunRaqami = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return utcDateToDateOnlyString(new Date(d.getTime() - (kunRaqami - 1) * KUN_MS));
}

function kunlikQatorlar(nuqtalar: DailyPoint[]): DavrQatori[] {
  return nuqtalar.map((p) => ({
    kalit: p.date,
    yorliq: kunYorliq(p.date),
    kirim: p.kirim,
    chiqim: p.chiqim,
    sof: p.kirim - p.chiqim,
  }));
}

/**
 * Kunlik nuqtalarni haftalarga yig'adi (dushanba–yakshanba).
 *
 * Hafta oyning chetidan chiqib ketishi mumkin, shuning uchun yorliqda
 * ikkala chet sanasi ko'rsatiladi — foydalanuvchi qaysi kunlar hisobga
 * olinganini ko'rib turadi. Raqamlar esa FAQAT tanlangan oy kunlaridan.
 */
function haftalikQatorlar(nuqtalar: DailyPoint[]): DavrQatori[] {
  const xarita = new Map<string, { kirim: number; chiqim: number; birinchi: string; oxirgi: string }>();
  for (const p of nuqtalar) {
    const kalit = haftaBoshi(p.date);
    const q = xarita.get(kalit) ?? { kirim: 0, chiqim: 0, birinchi: p.date, oxirgi: p.date };
    q.kirim += p.kirim;
    q.chiqim += p.chiqim;
    if (p.date < q.birinchi) q.birinchi = p.date;
    if (p.date > q.oxirgi) q.oxirgi = p.date;
    xarita.set(kalit, q);
  }
  return [...xarita.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([kalit, q]) => ({
      kalit,
      yorliq: q.birinchi === q.oxirgi ? kunYorliq(q.birinchi) : `${kunYorliq(q.birinchi)} — ${kunYorliq(q.oxirgi)}`,
      kirim: q.kirim,
      chiqim: q.chiqim,
      sof: q.kirim - q.chiqim,
    }));
}

function yillikQatorlar(nuqtalar: TrendPoint[]): DavrQatori[] {
  return nuqtalar.map((p) => ({
    kalit: p.month,
    yorliq: OYLAR[Number(p.month.slice(5, 7)) - 1] ?? p.month,
    kirim: p.jamiKirim,
    chiqim: p.jamiChiqim,
    sof: p.sofFoyda,
  }));
}

/**
 * Kunlik/haftalik/yillik kesim. "oylik" bu yerda hisoblanmaydi — u
 * `getMonthlyReport` (kategoriya, qarz, avto bo'limlari bilan) orqali
 * chiziladi va O'ZGARMAGAN.
 */
export async function getDavriyHisobot(
  businessId: string,
  monthStr: string,
  davr: Exclude<Davr, "oylik">
): Promise<DavriyHisobot> {
  const yil = Number(monthStr.slice(0, 4));
  if (davr === "yillik") {
    // Kalendar yili: yanvardan dekabrgacha (kelasi oylar nol bo'lib turadi).
    const qatorlar = yillikQatorlar(await getTrend(businessId, 12, `${yil}-12`));
    return { davr, sarlavha: `${yil}-yil`, qatorlar, ...jamla(qatorlar) };
  }
  const nuqtalar = await getDailyDynamics(businessId, monthStr);
  const qatorlar = davr === "kunlik" ? kunlikQatorlar(nuqtalar) : haftalikQatorlar(nuqtalar);
  const { from } = monthRangeUTC(monthStr);
  const sarlavha = `${OYLAR[from.getUTCMonth()]} ${from.getUTCFullYear()}`;
  return { davr, sarlavha, qatorlar, ...jamla(qatorlar) };
}
