/**
 * KPI HISOB YADROSI — sof funksiyalar, bazasiz va kontekstsiz.
 *
 * Butun oylik shu fayldagi uchta qoidadan chiqadi:
 *   1. `progressivSotuvBonusi` — har interval O'Z foizi bilan;
 *   2. `ballFoizi` + `vazifaHaqi` — ball vazifa haqini kamaytiradi/oshiradi;
 *   3. `planBonusi` — plan bajarilsa qat'iy summa.
 *
 * NEGA SOF: hisob qoidasi biznes uchun eng qimmat qism — u bazaga, sessiyaga
 * yoki tarmoqqa bog'lanmasa, `tests/kpi-hisob.test.ts` uni bir necha o'nlab
 * chegara qiymatida bir soniyada tekshiradi.
 *
 * PUL VA FOIZ BUTUN SONDA. Loyihada float taqiqlangan (CLAUDE.md), shuning
 * uchun foiz YUZDAN BIR aniqlikda saqlanadi: 2% → 200, 110% → 11000.
 * Hisob `summa × foiz / 10000` ko'rinishida, natija bir marta yaxlitlanadi.
 */

/** Foiz maxraji: `foiz` maydonlari shu songa bo'linadi (200 → 2%). */
export const FOIZ_BAZA = 10_000;

/** Progressiv bonus intervali. `gacha` null — yuqori chegara yo'q. */
export interface BonusIntervali {
  dan: number;
  gacha: number | null;
  /** Yuzdan bir aniqlikda (2% → 200). */
  foiz: number;
}

/** Bonus hisobining bitta qatori — UI'dagi "breakdown" aynan shu. */
export interface BonusQatori {
  dan: number;
  gacha: number | null;
  foiz: number;
  /** Shu intervalga tushgan sotuv qismi (so'm). */
  summa: number;
  /** Shu qismdan chiqqan bonus (so'm). */
  bonus: number;
}

export interface BonusNatijasi {
  jami: number;
  qatorlar: BonusQatori[];
}

/**
 * Summani foizga ko'paytiradi (butun son, bir marta yaxlitlash).
 *
 * `summa × foiz` 200 mlrd atrofida bo'lsa ham `Number.MAX_SAFE_INTEGER`
 * (9×10^15) dan uzoq — 200 000 000 × 11000 = 2.2×10^12.
 */
export function foizdan(summa: number, foiz: number): number {
  return Math.round((summa * foiz) / FOIZ_BAZA);
}

/**
 * PROGRESSIV SOTUV BONUSI.
 *
 * ENG KO'P YANGLISHADIGAN JOY: bu "sotuv qaysi intervalga tushdi — o'sha
 * foizni butun summaga qo'llash" EMAS. Har interval o'z ulushi bilan
 * alohida hisoblanadi, natijalar qo'shiladi. 150 mln uchun 5% emas:
 *   40mln×2% + 40mln×3% + 40mln×4% + 30mln×5% = 5 100 000.
 *
 * Intervallar `dan` bo'yicha tartiblanadi; oralarida bo'shliq bo'lsa
 * (noto'g'ri sozlama) o'sha qism bonussiz qoladi — jimgina 0% qo'llanadi,
 * chunki "yozilmagan interval uchun pul berish" xato bo'lardi.
 */
export function progressivSotuvBonusi(
  sotuv: number,
  intervallar: BonusIntervali[]
): BonusNatijasi {
  if (sotuv <= 0 || intervallar.length === 0) return { jami: 0, qatorlar: [] };

  const tartibli = [...intervallar].sort((a, b) => a.dan - b.dan);
  const qatorlar: BonusQatori[] = [];
  let jami = 0;

  for (const i of tartibli) {
    if (sotuv <= i.dan) break;
    const yuqori = i.gacha === null ? sotuv : Math.min(sotuv, i.gacha);
    const qism = yuqori - i.dan;
    if (qism <= 0) continue;
    const bonus = foizdan(qism, i.foiz);
    jami += bonus;
    qatorlar.push({ dan: i.dan, gacha: i.gacha, foiz: i.foiz, summa: qism, bonus });
  }

  return { jami, qatorlar };
}

/** Ball → foiz qoidasi. Chegaralar INCLUSIVE (min ≤ ball ≤ max). */
export interface BallQoidasi {
  minBall: number;
  maxBall: number;
  /** Yuzdan bir aniqlikda (110% → 11000). */
  foiz: number;
}

/**
 * Ballga mos to'lov foizi. Mos qoida topilmasa 0 — "qoida yo'q" holati
 * pul BERMASLIK tomonga hal qilinadi (fail-closed).
 *
 * Qoidalar bir-birini qoplasa eng YUQORI `minBall` li g'olib bo'ladi:
 * shunda "100 → 110%" alohida qatori "85–99 → 100%" bilan chalkashmaydi.
 */
export function ballFoizi(ball: number, qoidalar: BallQoidasi[]): number {
  let natija = 0;
  let engYuqoriMin = -1;
  for (const q of qoidalar) {
    if (ball >= q.minBall && ball <= q.maxBall && q.minBall > engYuqoriMin) {
      natija = q.foiz;
      engYuqoriMin = q.minBall;
    }
  }
  return natija;
}

/** Vazifa haqi = oylik haq × ball foizi. */
export function vazifaHaqi(oylikHaq: number, foiz: number): number {
  return foizdan(oylikHaq, foiz);
}

/**
 * Ballni ko'rinadigan chegaraga soladi: [0, boshlang'ich].
 *
 * Xom yig'indi manfiy bo'lishi mumkin (jarimalar boshlang'ich balldan
 * oshsa). Ko'rsatishda 0 dan pastga tushirilmaydi — to'lov foizi 40 dan
 * past bo'lganda allaqachon 0% bo'lgani uchun hisobga ta'sir qilmaydi.
 */
export function ballChegarasi(xom: number, boshlangich: number): number {
  return Math.max(0, Math.min(boshlangich, xom));
}

/**
 * PLAN BONUSI — plan BAJARILSA (sotuv ≥ maqsad) qat'iy summa, aks holda 0.
 * Qisman bajarilishga qisman bonus YO'Q: chegara aniq bo'lishi kerak.
 * `maqsad <= 0` — plan qo'yilmagan, bonus ham yo'q.
 */
export function planBonusi(sotuv: number, maqsad: number, bonus: number): number {
  if (maqsad <= 0) return 0;
  return sotuv >= maqsad ? bonus : 0;
}

/** Plan bajarilish foizi (butun; 100 dan oshishi mumkin). */
export function planFoizi(sotuv: number, maqsad: number): number {
  return maqsad > 0 ? Math.round((sotuv / maqsad) * 100) : 0;
}

/**
 * JAMI OYLIK.
 *
 * BALL FAQAT VAZIFA HAQIGA TA'SIR QILADI. Sotuv bonusi va plan bonusi
 * balldan MUSTAQIL: xodim ballini yo'qotsa ham sotgan pulining bonusi
 * kesilmaydi (aks holda bir xato ikki marta jazolanardi).
 */
export function jamiOylik(p: {
  vazifaHaqi: number;
  sotuvBonusi: number;
  planBonusi: number;
  tuzatish?: number;
}): number {
  return p.vazifaHaqi + p.sotuvBonusi + p.planBonusi + (p.tuzatish ?? 0);
}

/** Ball holati — kartochkadagi rangli belgi. */
export type BallHolati = "yaxshi" | "ogohlantirish" | "risk" | "kritik";

export function ballHolati(ball: number): BallHolati {
  if (ball >= 85) return "yaxshi";
  if (ball >= 70) return "ogohlantirish";
  if (ball >= 55) return "risk";
  return "kritik";
}
