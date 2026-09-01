import { todayTashkentDateOnlyString } from "@/lib/date";

/**
 * Xodimlar statistikasi davr yordamchilari — API va sahifa bir xil default
 * ("Bu oy", Toshkent kalendari) bilan ishlashi uchun bitta joyda.
 */

const SANA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface SanaOraliq {
  from: string;
  to: string;
}

/** Joriy oy (Toshkent): oy boshi → bugun. */
export function joriyOyOraliq(now: Date = new Date()): SanaOraliq {
  const bugun = todayTashkentDateOnlyString(now);
  return { from: `${bugun.slice(0, 7)}-01`, to: bugun };
}

/** So'rovdan from/to o'qiydi; noto'g'ri yoki to'liqsiz bo'lsa null. */
export function sanaOraliqOqi(searchParams: URLSearchParams): SanaOraliq | null {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to || !SANA_REGEX.test(from) || !SANA_REGEX.test(to)) return null;
  // Teskari oraliq bo'sh natija berardi — foydalanuvchi adashganda to'g'rilab yuboriladi.
  return from <= to ? { from, to } : { from: to, to: from };
}

/**
 * DAVR TUGMALARI (22-talab) — "Bugun / Shu hafta / Shu oy / O'tgan oy".
 * Server ham, brauzer ham AYNI funksiyadan foydalanadi: filtr matni va
 * hisoblangan oraliq hech qachon bir-biridan siljimasin.
 */
export const DAVR_TUGMALARI = ["bugun", "hafta", "oy", "otganOy"] as const;
export type DavrKaliti = (typeof DAVR_TUGMALARI)[number];

export const DAVR_NOMI: Record<DavrKaliti, string> = {
  bugun: "Bugun",
  hafta: "Shu hafta",
  oy: "Shu oy",
  otganOy: "O'tgan oy",
};

const KUN_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" ni kun qo'shib/ayirib qaytaradi (UTC-yarim tun asosida). */
function kunQosh(sana: string, delta: number): string {
  const d = new Date(`${sana}T00:00:00.000Z`);
  return new Date(d.getTime() + delta * KUN_MS).toISOString().slice(0, 10);
}

/**
 * Tanlangan davr oralig'i. Hafta DUSHANBADAN boshlanadi (O'zbekistonda ish
 * haftasi shunday); "O'tgan oy" — oyning to'liq birinchi-oxirgi kuni.
 */
export function davrOraligi(kalit: DavrKaliti, now: Date = new Date()): SanaOraliq {
  const bugun = todayTashkentDateOnlyString(now);
  if (kalit === "bugun") return { from: bugun, to: bugun };

  if (kalit === "hafta") {
    // getUTCDay: 0 — yakshanba. Dushanbagacha nechta kun orqaga qaytish kerak.
    const haftaKuni = new Date(`${bugun}T00:00:00.000Z`).getUTCDay();
    const orqaga = haftaKuni === 0 ? 6 : haftaKuni - 1;
    return { from: kunQosh(bugun, -orqaga), to: bugun };
  }

  if (kalit === "otganOy") {
    const oyBoshi = `${bugun.slice(0, 7)}-01`;
    const otgan = kunQosh(oyBoshi, -1);
    return { from: `${otgan.slice(0, 7)}-01`, to: otgan };
  }

  return { from: `${bugun.slice(0, 7)}-01`, to: bugun };
}

/** "YYYY-MM" oyining to'liq oralig'i ("YYYY-MM-01" → oyning oxirgi kuni). */
export function oyOraligi(oy: string): SanaOraliq {
  const [y, m] = oy.split("-").map(Number);
  // Keyingi oyning 0-kuni = shu oyning oxirgi kuni (UTC).
  const oxirgi = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from: `${oy}-01`, to: oxirgi };
}
