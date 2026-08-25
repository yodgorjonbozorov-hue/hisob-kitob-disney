import { formatMoneyCompact, formatPercent, uzOyNomi } from "@/lib/format";
import { parseMonthString } from "@/lib/date";
import type { MonthSummary, CategoryBreakdownItem } from "@/lib/queries/dashboard";

/**
 * BALANSA INSIGHT — DETERMINISTIK xulosa dvigateli.
 *
 * AI CHAQIRUVI YO'Q va ataylab yo'q: bu blok "nima bo'lgani" ni aytadi,
 * "nega bo'lgani" ni EMAS. Sabab ma'lumotda yo'q — "foyda reklama sabab
 * kamaydi" degan xulosa chiqarish uchun reklama xarajati bilan tushum
 * o'rtasidagi bog'liqlikni o'lchaydigan ma'lumot kerak, bizda esa u yo'q.
 * Shuning uchun bu yerda FAQAT hisoblab bo'ladigan faktlar bor.
 *
 * Sof funksiya — DB'ga tegmaydi, test qilish oson.
 */

export type InsightTon = "ijobiy" | "salbiy" | "betaraf";

export interface Insight {
  /** Barqaror kalit — React `key` va test uchun. */
  kod: string;
  matn: string;
  ton: InsightTon;
}

export interface InsightKirish {
  /** Tanlangan oy xulosasi (joriy + oldingi oy + %). */
  xulosa: MonthSummary;
  /** Kirim kategoriyalari — kamayish tartibida (getCategoryBreakdown). */
  kirimKategoriyalar: CategoryBreakdownItem[];
  /** Chiqim kategoriyalari — kamayish tartibida. */
  chiqimKategoriyalar: CategoryBreakdownItem[];
  /** Barcha faol kassalar joriy qoldig'i. Berilmasa — bu xulosa chiqmaydi. */
  kassaJami?: number | null;
  /** Ochiq qarzdorlik (menga qarzdor). Berilmasa — bu xulosa chiqmaydi. */
  qarzOlinadigan?: number | null;
}

/** Ko'rsatiladigan maksimal xulosa soni — blok ro'yxatga aylanib ketmasin. */
export const INSIGHT_MAKS = 4;

/**
 * "Sezilarli o'zgarish" chegarasi (%). Bundan kichik farq shovqin: 1.2%
 * o'zgarishni "kirim kamaydi" deb ko'rsatish foydalanuvchini chalg'itadi.
 */
const SEZILARLI_FOIZ = 5;

/** "12,4 mln so'm" — kartalardagi format bilan bir xil. */
function som(value: number): string {
  return `${formatMoneyCompact(value)} so'm`;
}

/** "Avgust" — oy nomi (yilsiz: yil sarlavhada turibdi). */
function oyNomi(monthStr: string): string {
  const { monthIndex0 } = parseMonthString(monthStr);
  return uzOyNomi(monthIndex0);
}

/** Foiz matni belgisiz — jumla ichida "-21.9% kamaydi" g'alati o'qiladi. */
function foizAbs(pct: number): string {
  return formatPercent(Math.abs(pct)).replace("+", "");
}

/**
 * Eng muhim 2–4 xulosani tanlaydi.
 *
 * TARTIB — ahamiyat bo'yicha: avval sof natija (biznes savoli No1), keyin
 * kirim/chiqim dinamikasi, keyin eng katta kategoriyalar, oxirida holat
 * (kassa/qarz). Ro'yxat `INSIGHT_MAKS` da kesiladi.
 */
export function insightlarniHisobla(kirish: InsightKirish): Insight[] {
  const { xulosa, kirimKategoriyalar, chiqimKategoriyalar } = kirish;
  const oy = oyNomi(xulosa.month);
  const out: Insight[] = [];

  const yozuvBor =
    xulosa.jamiKirim > 0 ||
    xulosa.jamiChiqim > 0 ||
    xulosa.prevMonth.jamiKirim > 0 ||
    xulosa.prevMonth.jamiChiqim > 0;

  // Yozuv umuman bo'lmasa — sun'iy xulosa yasalmaydi.
  if (!yozuvBor) return [];

  // 1. SOF NATIJA. Zarar — eng muhim signal, shuning uchun birinchi.
  if (xulosa.sofFoyda < 0) {
    out.push({
      kod: "sof-zarar",
      matn: `${oy}da chiqim kirimdan ${som(Math.abs(xulosa.sofFoyda))} ko'p — oy zarar bilan ketmoqda.`,
      ton: "salbiy",
    });
  } else if (xulosa.changePct.sofFoyda !== null && Math.abs(xulosa.changePct.sofFoyda) >= SEZILARLI_FOIZ) {
    const osdi = xulosa.changePct.sofFoyda > 0;
    out.push({
      kod: "sof-ozgarish",
      matn: `Sof natija o'tgan oyga nisbatan ${foizAbs(xulosa.changePct.sofFoyda)} ${
        osdi ? "o'sdi" : "pasaydi"
      } — ${som(xulosa.sofFoyda)}.`,
      ton: osdi ? "ijobiy" : "salbiy",
    });
  }

  // 2. KIRIM DINAMIKASI.
  if (xulosa.changePct.kirim !== null && Math.abs(xulosa.changePct.kirim) >= SEZILARLI_FOIZ) {
    const osdi = xulosa.changePct.kirim > 0;
    out.push({
      kod: "kirim-ozgarish",
      matn: `${oy}da kirim o'tgan oyga nisbatan ${foizAbs(xulosa.changePct.kirim)} ${
        osdi ? "oshgan" : "kamaygan"
      }.`,
      ton: osdi ? "ijobiy" : "salbiy",
    });
  }

  // 3. CHIQIM DINAMIKASI — faqat kirimdan mustaqil signal bo'lsa.
  if (xulosa.changePct.chiqim !== null && Math.abs(xulosa.changePct.chiqim) >= SEZILARLI_FOIZ) {
    const osdi = xulosa.changePct.chiqim > 0;
    out.push({
      kod: "chiqim-ozgarish",
      matn: `Chiqim o'tgan oyga nisbatan ${foizAbs(xulosa.changePct.chiqim)} ${
        osdi ? "oshgan" : "kamaygan"
      }.`,
      // Chiqimning o'sishi yomon, kamayishi yaxshi — kirimning teskarisi.
      ton: osdi ? "salbiy" : "ijobiy",
    });
  }

  // 4. ENG KATTA KIRIM KATEGORIYASI (ro'yxat kamayish tartibida keladi).
  const engKirim = kirimKategoriyalar[0];
  if (engKirim && engKirim.summa > 0) {
    out.push({
      kod: "kirim-kategoriya",
      matn: `Eng katta kirim manbai — ${engKirim.nomi}: ${som(engKirim.summa)} (kirimning ${engKirim.foiz.toFixed(0)}%i).`,
      ton: "betaraf",
    });
  }

  // 5. ENG KATTA CHIQIM KATEGORIYASI.
  const engChiqim = chiqimKategoriyalar[0];
  if (engChiqim && engChiqim.summa > 0) {
    out.push({
      kod: "chiqim-kategoriya",
      matn: `Eng katta chiqim — ${engChiqim.nomi}: ${som(engChiqim.summa)} (chiqimning ${engChiqim.foiz.toFixed(0)}%i).`,
      ton: "betaraf",
    });
  }

  // 6. QARZDORLIK — oylik kirim bilan taqqoslanadi (miqyosni beradi).
  const qarz = kirish.qarzOlinadigan ?? 0;
  if (qarz > 0 && xulosa.jamiKirim > 0) {
    const ulush = (qarz / xulosa.jamiKirim) * 100;
    if (ulush >= 25) {
      out.push({
        kod: "qarz-ulush",
        matn: `Ochiq qarzdorlik ${som(qarz)} — bu ${oy} kirimining ${ulush.toFixed(0)}%iga teng.`,
        ton: "salbiy",
      });
    }
  }

  // 7. KASSA QOLDIG'I — manfiy bo'lsa buxgalteriya xatosi, aytilishi shart.
  const kassa = kirish.kassaJami;
  if (typeof kassa === "number" && kassa < 0) {
    out.push({
      kod: "kassa-manfiy",
      matn: `Kassa qoldig'i manfiy (${som(kassa)}) — yozuvlarni tekshiring.`,
      ton: "salbiy",
    });
  }

  return out.slice(0, INSIGHT_MAKS);
}
