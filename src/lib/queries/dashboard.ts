import { perRequestCache } from "@/lib/perRequestCache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentTenantId } from "@/lib/db/tenantContext";
import { monthRangeUTC, shiftMonthString, currentMonthString } from "@/lib/date";

/**
 * Boshqaruv paneli agregatlari.
 *
 * TEZLIK HAQIDA: ilgari har bir ko'rsatkich alohida `aggregate`/`groupBy` so'rovi edi —
 * faqat 6 oylik dinamika 12 ta so'rov qilardi (oy × turi), umumiy panel esa ~21 ta.
 * Turso/libsql uzoq baza bo'lgani uchun har bir so'rov alohida HTTP borish-kelishi.
 * Endi har bir ko'rsatkich BITTA guruhlangan SQL so'rovi bilan olinadi (jami 4 ta).
 *
 * XAVFSIZLIK: xom SQL tenant kengaytmasidan (lib/db/tenantDb.ts) o'tmaydi, shuning uchun
 * har bir so'rovga `EXISTS (... Business ... tenantId = ?)` sharti QO'LDA qo'shilgan —
 * boshqa kompaniyaning businessId'si berilsa natija bo'sh qaytadi.
 *
 * Sana ustuni (`sana`) SQLite'da ISO matn ("2026-08-04T00:00:00+00:00") sifatida
 * saqlanadi, shuning uchun oy/kun kesimi `substr` bilan olinadi — UTC, `monthRangeUTC`
 * bilan bir xil hisob.
 */

/** Faqat shu tenantga tegishli biznes yozuvlari — xom SQL uchun qo'lbola tenant filtri. */
function tenantScope(businessId: string): Prisma.Sql {
  return Prisma.sql`t."businessId" = ${businessId} AND EXISTS (
    SELECT 1 FROM "Business" b WHERE b."id" = t."businessId" AND b."tenantId" = ${currentTenantId()}
  )`;
}

/** libsql SUM() BigInt qaytarishi mumkin — barcha joyda oddiy raqamga keltiramiz. */
function son(v: unknown): number {
  return v == null ? 0 : Number(v);
}

export interface MonthTotals {
  jamiKirim: number;
  jamiChiqim: number;
  sofFoyda: number;
}

export interface MonthSummary extends MonthTotals {
  month: string;
  prevMonth: MonthTotals;
  changePct: {
    kirim: number | null;
    chiqim: number | null;
    sofFoyda: number | null;
  };
}

interface OyQatori {
  oy: string;
  turi: string;
  jami: unknown;
}

/**
 * [fromMonth, toMonth] oralig'idagi har oy uchun kirim/chiqim yig'indisi — BITTA so'rov.
 * Natija oy -> totals xaritasi. React cache: bir so'rov ichida bir xil oraliq
 * qayta so'ralsa baza o'qilmaydi.
 */
const monthlyTotals = perRequestCache(async function monthlyTotals(
  businessId: string,
  fromMonth: string,
  toMonth: string
): Promise<Map<string, MonthTotals>> {
  const { from } = monthRangeUTC(fromMonth);
  const { to } = monthRangeUTC(toMonth);

  const rows = await prisma.$queryRaw<OyQatori[]>`
    SELECT substr(t."sana", 1, 7) AS oy, t."turi" AS turi, SUM(t."summa") AS jami
    FROM "Transaction" t
    WHERE ${tenantScope(businessId)}
      AND t."sana" >= ${from} AND t."sana" < ${to}
    GROUP BY oy, t."turi"
  `;

  const map = new Map<string, MonthTotals>();
  for (const r of rows) {
    const cur = map.get(r.oy) ?? { jamiKirim: 0, jamiChiqim: 0, sofFoyda: 0 };
    if (r.turi === "kirim") cur.jamiKirim += son(r.jami);
    else if (r.turi === "chiqim") cur.jamiChiqim += son(r.jami);
    cur.sofFoyda = cur.jamiKirim - cur.jamiChiqim;
    map.set(r.oy, cur);
  }
  return map;
});

const BOSH_TOTALS: MonthTotals = { jamiKirim: 0, jamiChiqim: 0, sofFoyda: 0 };

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export async function getMonthSummary(
  businessId: string,
  monthStr: string = currentMonthString()
): Promise<MonthSummary> {
  const prevMonthStr = shiftMonthString(monthStr, -1);
  // Ikkala oy ham bitta so'rovda (avval 4 ta alohida aggregate edi).
  const totals = await monthlyTotals(businessId, prevMonthStr, monthStr);
  const curr = totals.get(monthStr) ?? BOSH_TOTALS;
  const prev = totals.get(prevMonthStr) ?? BOSH_TOTALS;

  return {
    month: monthStr,
    ...curr,
    prevMonth: prev,
    changePct: {
      kirim: pctChange(curr.jamiKirim, prev.jamiKirim),
      chiqim: pctChange(curr.jamiChiqim, prev.jamiChiqim),
      sofFoyda: pctChange(curr.sofFoyda, prev.sofFoyda),
    },
  };
}

export interface CategoryBreakdownItem {
  categoryId: string;
  nomi: string;
  summa: number;
  foiz: number;
}

/**
 * Kategoriya kesimi — BITTA so'rov (avval: groupBy + kategoriya nomlari uchun
 * ikkinchi so'rov). Nomi JOIN orqali keladi.
 */
export async function getCategoryBreakdown(
  businessId: string,
  monthStr: string,
  turi: "kirim" | "chiqim"
): Promise<CategoryBreakdownItem[]> {
  const { from, to } = monthRangeUTC(monthStr);

  const rows = await prisma.$queryRaw<{ categoryId: string; nomi: string | null; jami: unknown }[]>`
    SELECT t."categoryId" AS categoryId, c."nomi" AS nomi, SUM(t."summa") AS jami
    FROM "Transaction" t
    LEFT JOIN "Category" c ON c."id" = t."categoryId"
    WHERE ${tenantScope(businessId)}
      AND t."turi" = ${turi}
      AND t."sana" >= ${from} AND t."sana" < ${to}
    GROUP BY t."categoryId", c."nomi"
    ORDER BY SUM(t."summa") DESC
  `;

  const total = rows.reduce((acc, r) => acc + son(r.jami), 0);
  return rows.map((r) => {
    const summa = son(r.jami);
    return {
      categoryId: r.categoryId,
      nomi: r.nomi ?? "Noma'lum",
      summa,
      foiz: total > 0 ? (summa / total) * 100 : 0,
    };
  });
}

export interface TrendPoint {
  month: string;
  jamiKirim: number;
  jamiChiqim: number;
  sofFoyda: number;
}

/**
 * So'nggi N oy dinamikasi — BITTA so'rov (avval oy × turi = 2N ta aggregate,
 * ya'ni 6 oy uchun 12 ta borish-kelish).
 */
export async function getTrend(
  businessId: string,
  months: number = 6,
  endMonth: string = currentMonthString()
): Promise<TrendPoint[]> {
  const startMonth = shiftMonthString(endMonth, -(months - 1));
  const totals = await monthlyTotals(businessId, startMonth, endMonth);

  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = shiftMonthString(endMonth, -i);
    points.push({ month: m, ...(totals.get(m) ?? BOSH_TOTALS) });
  }
  return points;
}

export interface DailyPoint {
  date: string;
  kirim: number;
  chiqim: number;
}

/**
 * Kunlik dinamika — bazada guruhlanadi. Avval oyning BARCHA tranzaksiya qatorlari
 * tarmoq orqali tortilib, JS'da yig'ilardi; endi faqat kun boshiga bitta qator keladi.
 */
export async function getDailyDynamics(
  businessId: string,
  monthStr: string = currentMonthString()
): Promise<DailyPoint[]> {
  const { from, to } = monthRangeUTC(monthStr);

  const rows = await prisma.$queryRaw<{ kun: string; turi: string; jami: unknown }[]>`
    SELECT substr(t."sana", 1, 10) AS kun, t."turi" AS turi, SUM(t."summa") AS jami
    FROM "Transaction" t
    WHERE ${tenantScope(businessId)}
      AND t."sana" >= ${from} AND t."sana" < ${to}
    GROUP BY kun, t."turi"
    ORDER BY kun ASC
  `;

  const byDate = new Map<string, DailyPoint>();
  for (const r of rows) {
    const point = byDate.get(r.kun) ?? { date: r.kun, kirim: 0, chiqim: 0 };
    if (r.turi === "kirim") point.kirim += son(r.jami);
    else if (r.turi === "chiqim") point.chiqim += son(r.jami);
    byDate.set(r.kun, point);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
