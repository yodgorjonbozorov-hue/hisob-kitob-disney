import { prisma } from "@/lib/prisma";
import { QARZ_EMAS } from "@/lib/qarzFiltr";
import { formatMoneyCompact } from "@/lib/format";
import { dateOnlyStringToUTCDate, todayTashkentDateOnlyString } from "@/lib/date";
import { getTrend } from "@/lib/queries/dashboard";
import { getAccountBalances } from "@/lib/queries/accounts";
import { getDebtTotals } from "@/lib/queries/inventory";
import { listQarzdorlar, listQarzlar } from "@/lib/queries/qarz";
import { getOmborStats } from "@/lib/queries/inventory";
import { getSotuvStatistika } from "@/lib/queries/sotuvStatistika";
import { listMijozlar } from "@/lib/queries/mijoz";
import { oldingiDavr, type Davr } from "./davr";

/**
 * AI COPILOT — DETERMINISTIK ANALITIKA QATLAMI.
 *
 * BU FAYLNING BOR MA'NOSI: modelga XOM ma'lumot berilmaydi va model
 * hech qachon hisob-kitob qilmaydi. Har agregat (yig'indi, farq, foiz,
 * "eng kattasi") SHU YERDA — bazada va serverda — hisoblanadi, modelga esa
 * TAYYOR raqam va TAYYOR matn ("138,3 mln so'm") boradi. Model faqat
 * tanlaydi va o'zbekcha tushuntiradi.
 *
 * Shu bois:
 *   · raqam "o'ylab topilishi" mumkin emas — u tool natijasida bor yoki yo'q;
 *   · 1000 ta tranzaksiya JSON bo'lib modelga ketmaydi (token va maxfiylik);
 *   · har javob orqasida aniq SQL agregati turadi va test bilan tekshiriladi.
 *
 * Har funksiya `businessId` oladi va tenant konteksti ichida chaqiriladi
 * (`prisma` — tenant-scoped klient), ya'ni boshqa tenant ma'lumoti prinsipial
 * ravishda yetib kelmaydi.
 */

/** Balansa sahifasiga o'tish havolasi (drill-down). */
export interface Havola {
  yorliq: string;
  /** Faqat ichki `/app/...` yo'l — mijoz tomonda ham shu tekshiriladi. */
  href: string;
}

/** Pul matni — model AYNAN shu matnni ko'chiradi, o'zi formatlamaydi. */
export function pulMatn(som: number): string {
  return `${formatMoneyCompact(som)} so'm`;
}

function foiz(joriy: number, oldingi: number): number | null {
  if (oldingi === 0) return joriy === 0 ? 0 : null;
  return Math.round(((joriy - oldingi) / Math.abs(oldingi)) * 1000) / 10;
}

function foizMatn(v: number | null): string {
  if (v === null) return "solishtirib bo'lmaydi (oldingi davrda 0 edi)";
  const belgi = v > 0 ? "+" : "";
  return `${belgi}${v.toString().replace(".", ",")}%`;
}

function tranzaksiyaHavola(davr: Davr, qoshimcha: Record<string, string> = {}): string {
  const p = new URLSearchParams({ from: davr.fromStr, to: davr.toStr, ...qoshimcha });
  return `/app/tranzaksiyalar?${p.toString()}`;
}

// ---------------------------------------------------------------------------
// 1. Davr yakuni: kirim / chiqim / sof natija + oldingi davr bilan solishtirish
// ---------------------------------------------------------------------------

interface Jamlanma {
  kirim: number;
  chiqim: number;
  sof: number;
}

/**
 * Davrdagi kirim va chiqim jami.
 *
 * Qarzga yozilgan kirim ATAYLAB hisobga olinmaydi (`QARZ_EMAS`) — bu butun
 * tizimdagi bir xil qoida (`lib/qarzFiltr.ts`), ya'ni AI javobi bosh sahifa
 * va oylik hisobot bilan bir xil raqamni beradi.
 */
async function jamlanmaOl(businessId: string, davr: Davr): Promise<Jamlanma> {
  const rows = await prisma.transaction.groupBy({
    by: ["turi"],
    where: {
      businessId,
      deletedAt: null,
      sana: { gte: davr.from, lt: davr.to },
      ...QARZ_EMAS,
    },
    _sum: { summa: true },
  });
  const kirim = rows.find((r) => r.turi === "kirim")?._sum.summa ?? 0;
  const chiqim = rows.find((r) => r.turi === "chiqim")?._sum.summa ?? 0;
  return { kirim, chiqim, sof: kirim - chiqim };
}

export interface DavrYakuni {
  davr: string;
  oraliq: string;
  kirim: number;
  kirimMatn: string;
  chiqim: number;
  chiqimMatn: string;
  sofNatija: number;
  sofNatijaMatn: string;
  oldingiDavr: string;
  oldingi: { kirim: number; chiqim: number; sofNatija: number; sofNatijaMatn: string };
  ozgarish: {
    kirimFoiz: string;
    chiqimFoiz: string;
    kirimFarqMatn: string;
    chiqimFarqMatn: string;
    sofFarqMatn: string;
  };
  havolalar: Havola[];
}

export async function davrYakuni(businessId: string, davr: Davr): Promise<DavrYakuni> {
  const oldingi = oldingiDavr(davr);
  const [joriy, oldin] = await Promise.all([
    jamlanmaOl(businessId, davr),
    jamlanmaOl(businessId, oldingi),
  ]);

  const farq = (a: number, b: number) => {
    const d = a - b;
    return `${d >= 0 ? "+" : "−"}${pulMatn(Math.abs(d))}`;
  };

  return {
    davr: davr.nomi,
    oraliq: `${davr.fromStr} … ${davr.toStr}`,
    kirim: joriy.kirim,
    kirimMatn: pulMatn(joriy.kirim),
    chiqim: joriy.chiqim,
    chiqimMatn: pulMatn(joriy.chiqim),
    sofNatija: joriy.sof,
    sofNatijaMatn: pulMatn(joriy.sof),
    oldingiDavr: oldingi.nomi,
    oldingi: {
      kirim: oldin.kirim,
      chiqim: oldin.chiqim,
      sofNatija: oldin.sof,
      sofNatijaMatn: pulMatn(oldin.sof),
    },
    ozgarish: {
      kirimFoiz: foizMatn(foiz(joriy.kirim, oldin.kirim)),
      chiqimFoiz: foizMatn(foiz(joriy.chiqim, oldin.chiqim)),
      kirimFarqMatn: farq(joriy.kirim, oldin.kirim),
      chiqimFarqMatn: farq(joriy.chiqim, oldin.chiqim),
      sofFarqMatn: farq(joriy.sof, oldin.sof),
    },
    havolalar: [
      { yorliq: "Yozuvlarni ko'rish", href: tranzaksiyaHavola(davr) },
      ...(davr.oy ? [{ yorliq: "Oylik hisobot", href: `/app/hisobot?month=${davr.oy}` }] : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// 2. Kategoriya kesimi (+ oldingi davr bilan farq)
// ---------------------------------------------------------------------------

export interface KategoriyaQator {
  kategoriya: string;
  summa: number;
  summaMatn: string;
  ulush: string;
  oldingiSumma: number;
  farqMatn: string;
  havola: string;
}

async function kategoriyaJamlari(
  businessId: string,
  davr: Davr,
  turi: "kirim" | "chiqim"
): Promise<Map<string, number>> {
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      businessId,
      turi,
      deletedAt: null,
      sana: { gte: davr.from, lt: davr.to },
      ...QARZ_EMAS,
    },
    _sum: { summa: true },
  });
  return new Map(rows.map((r) => [r.categoryId, r._sum.summa ?? 0]));
}

export interface KategoriyaKesimi {
  davr: string;
  turi: string;
  jami: number;
  jamiMatn: string;
  kategoriyalar: KategoriyaQator[];
  havolalar: Havola[];
}

export async function kategoriyaKesimi(
  businessId: string,
  davr: Davr,
  turi: "kirim" | "chiqim",
  limit = 5
): Promise<KategoriyaKesimi> {
  const oldingi = oldingiDavr(davr);
  const [joriy, oldin] = await Promise.all([
    kategoriyaJamlari(businessId, davr, turi),
    kategoriyaJamlari(businessId, oldingi, turi),
  ]);

  const jami = [...joriy.values()].reduce((a, b) => a + b, 0);
  const idlar = [...joriy.keys()];
  const nomlar = idlar.length
    ? new Map(
        (await prisma.category.findMany({ where: { id: { in: idlar } }, select: { id: true, nomi: true } })).map(
          (c) => [c.id, c.nomi]
        )
      )
    : new Map<string, string>();

  const kategoriyalar = idlar
    .map((id) => {
      const summa = joriy.get(id) ?? 0;
      const oldingiSumma = oldin.get(id) ?? 0;
      const d = summa - oldingiSumma;
      return {
        kategoriya: nomlar.get(id) ?? "Noma'lum",
        summa,
        summaMatn: pulMatn(summa),
        ulush: jami > 0 ? `${(Math.round((summa / jami) * 1000) / 10).toString().replace(".", ",")}%` : "0%",
        oldingiSumma,
        farqMatn: `${d >= 0 ? "+" : "−"}${pulMatn(Math.abs(d))} (${oldingi.nomi})`,
        havola: tranzaksiyaHavola(davr, { turi, categoryId: id }),
      };
    })
    .sort((a, b) => b.summa - a.summa)
    .slice(0, Math.min(10, Math.max(1, limit)));

  return {
    davr: davr.nomi,
    turi,
    jami,
    jamiMatn: pulMatn(jami),
    kategoriyalar,
    havolalar: [
      {
        yorliq: turi === "kirim" ? "Kirimlarni ko'rish" : "Chiqimlarni ko'rish",
        href: tranzaksiyaHavola(davr, { turi }),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 3. "Nega o'zgardi?" — dalilga asoslangan solishtirish
// ---------------------------------------------------------------------------

export interface SababTahlili {
  yakun: DavrYakuni;
  /** Eng kuchli o'zgargan kategoriyalar (kirim va chiqim aralash), farq bo'yicha. */
  ozgargan: Array<{
    kategoriya: string;
    turi: string;
    farq: number;
    farqMatn: string;
    joriyMatn: string;
    oldingiMatn: string;
    havola: string;
  }>;
  izoh: string;
}

/**
 * "Nega foyda kamaydi?" savolining DALIL bazasi.
 *
 * Bu yerda hech qanday sabab AYTILMAYDI — faqat qaysi kategoriya qancha
 * o'zgargani beriladi. Sababni model shu dalillardan yozadi; dalil yo'q
 * bo'lsa taxmin qilishi taqiqlangan (system prompt).
 */
export async function sababTahlili(businessId: string, davr: Davr): Promise<SababTahlili> {
  const oldingi = oldingiDavr(davr);
  const [yakun, kirimJoriy, kirimOldin, chiqimJoriy, chiqimOldin] = await Promise.all([
    davrYakuni(businessId, davr),
    kategoriyaJamlari(businessId, davr, "kirim"),
    kategoriyaJamlari(businessId, oldingi, "kirim"),
    kategoriyaJamlari(businessId, davr, "chiqim"),
    kategoriyaJamlari(businessId, oldingi, "chiqim"),
  ]);

  const idlar = new Set<string>([
    ...kirimJoriy.keys(),
    ...kirimOldin.keys(),
    ...chiqimJoriy.keys(),
    ...chiqimOldin.keys(),
  ]);
  const nomlar = idlar.size
    ? new Map(
        (
          await prisma.category.findMany({
            where: { id: { in: [...idlar] } },
            select: { id: true, nomi: true, turi: true },
          })
        ).map((c) => [c.id, c])
      )
    : new Map<string, { id: string; nomi: string; turi: string }>();

  const ozgargan = [...idlar]
    .map((id) => {
      const turi = (kirimJoriy.has(id) || kirimOldin.has(id) ? "kirim" : "chiqim") as "kirim" | "chiqim";
      const j = (turi === "kirim" ? kirimJoriy : chiqimJoriy).get(id) ?? 0;
      const o = (turi === "kirim" ? kirimOldin : chiqimOldin).get(id) ?? 0;
      const farq = j - o;
      return {
        kategoriya: nomlar.get(id)?.nomi ?? "Noma'lum",
        turi,
        farq,
        farqMatn: `${farq >= 0 ? "+" : "−"}${pulMatn(Math.abs(farq))}`,
        joriyMatn: pulMatn(j),
        oldingiMatn: pulMatn(o),
        havola: tranzaksiyaHavola(davr, { turi, categoryId: id }),
      };
    })
    .filter((r) => r.farq !== 0)
    .sort((a, b) => Math.abs(b.farq) - Math.abs(a.farq))
    .slice(0, 6);

  return {
    yakun,
    ozgargan,
    izoh:
      "Sof natija = kirim − chiqim. Sababni FAQAT shu ro'yxatdagi o'zgarishlar bilan tushuntir; " +
      "ro'yxatda yo'q sababni (bozor, mavsum, raqobat) taxmin qilma.",
  };
}

// ---------------------------------------------------------------------------
// 4. Eng katta yozuvlar
// ---------------------------------------------------------------------------

export interface KattaYozuvlar {
  davr: string;
  turi: string;
  yozuvlar: Array<{ sana: string; kategoriya: string; summaMatn: string; izoh: string | null }>;
  havolalar: Havola[];
}

export async function kattaYozuvlar(
  businessId: string,
  davr: Davr,
  turi: "kirim" | "chiqim",
  limit = 5
): Promise<KattaYozuvlar> {
  const rows = await prisma.transaction.findMany({
    where: {
      businessId,
      turi,
      deletedAt: null,
      sana: { gte: davr.from, lt: davr.to },
      ...QARZ_EMAS,
    },
    select: { sana: true, summa: true, izoh: true, category: { select: { nomi: true } } },
    orderBy: { summa: "desc" },
    take: Math.min(10, Math.max(1, limit)),
  });

  return {
    davr: davr.nomi,
    turi,
    yozuvlar: rows.map((r) => ({
      sana: r.sana.toISOString().slice(0, 10),
      kategoriya: r.category?.nomi ?? "Noma'lum",
      summaMatn: pulMatn(r.summa),
      izoh: r.izoh,
    })),
    havolalar: [
      { yorliq: "Yozuvlarni ko'rish", href: tranzaksiyaHavola(davr, { turi }) },
    ],
  };
}

// ---------------------------------------------------------------------------
// 5. Oylik trend
// ---------------------------------------------------------------------------

export interface TrendYakuni {
  oylar: Array<{ oy: string; kirimMatn: string; chiqimMatn: string; sofMatn: string; sof: number }>;
  osish: string;
  havolalar: Havola[];
}

export async function oylikTrend(businessId: string, oylarSoni: number, joriyOyStr: string): Promise<TrendYakuni> {
  const n = Math.min(12, Math.max(2, oylarSoni));
  const trend = await getTrend(businessId, n, joriyOyStr);
  const birinchi = trend[0];
  const oxirgi = trend[trend.length - 1];
  const f = foiz(oxirgi.sofFoyda, birinchi.sofFoyda);

  return {
    oylar: trend.map((t) => ({
      oy: t.month,
      kirimMatn: pulMatn(t.jamiKirim),
      chiqimMatn: pulMatn(t.jamiChiqim),
      sofMatn: pulMatn(t.sofFoyda),
      sof: t.sofFoyda,
    })),
    osish:
      f === null
        ? `${birinchi.month} oyida sof natija 0 edi — foizda o'sish hisoblanmaydi`
        : `${birinchi.month} → ${oxirgi.month}: sof natija ${foizMatn(f)}`,
    havolalar: [{ yorliq: "Oylik hisobot", href: `/app/hisobot?month=${oxirgi.month}` }],
  };
}

// ---------------------------------------------------------------------------
// 6. Qarzdorlik
// ---------------------------------------------------------------------------

export interface QarzYakuni {
  mengaQarzdorJami: string;
  menQarzdormanJami: string;
  sofQarzHolati: string;
  engKattaQarzdorlar: Array<{ mijoz: string; qoldiqMatn: string; muddatOtgan: boolean }>;
  muddatiOtganSoni: number;
  muddatiOtganJami: string;
  muddatiOtganlar: Array<{ mijoz: string; qoldiqMatn: string; muddat: string | null }>;
  havolalar: Havola[];
}

export async function qarzYakuni(businessId: string, limit = 5): Promise<QarzYakuni> {
  const [jami, qarzdorlar, otganlar] = await Promise.all([
    getDebtTotals(businessId),
    listQarzdorlar(businessId, { turi: "olinadigan" }),
    listQarzlar(businessId, { muddatOtgan: true }),
  ]);

  const n = Math.min(10, Math.max(1, limit));
  const otganJami = otganlar.reduce((a, d) => a + d.qolgan, 0);

  return {
    mengaQarzdorJami: pulMatn(jami.olinadigan),
    menQarzdormanJami: pulMatn(jami.beriladigan),
    sofQarzHolati: pulMatn(jami.sof),
    engKattaQarzdorlar: qarzdorlar
      .slice()
      .sort((a, b) => b.qarz - a.qarz)
      .slice(0, n)
      .map((q) => ({ mijoz: q.ism, qoldiqMatn: pulMatn(q.qarz), muddatOtgan: q.muddatOtdi })),
    muddatiOtganSoni: otganlar.length,
    muddatiOtganJami: pulMatn(otganJami),
    muddatiOtganlar: otganlar
      .slice(0, n)
      .map((d) => ({
        mijoz: d.mijozNomi,
        qoldiqMatn: pulMatn(d.qolgan),
        muddat: d.muddat ? d.muddat.slice(0, 10) : null,
      })),
    havolalar: [
      { yorliq: "Qarzdorlarni ko'rish", href: "/app/qarzlar?turi=olinadigan" },
      ...(otganlar.length > 0
        ? [{ yorliq: `${otganlar.length} ta muddati o'tgan qarz`, href: "/app/qarzlar?turi=olinadigan" }]
        : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// 7. Kassalar
// ---------------------------------------------------------------------------

export interface KassaYakuni {
  jamiMatn: string;
  kassalar: Array<{ nomi: string; qoldiqMatn: string; turi: string; faol: boolean }>;
  topilmadi?: string;
  havolalar: Havola[];
}

/** `nom` berilsa — faqat nomi mos kassalar ("Fayruza kassasida qancha pul bor?"). */
export async function kassaYakuni(businessId: string, nom?: string | null): Promise<KassaYakuni> {
  const hammasi = await getAccountBalances(businessId);
  const qidiruv = (nom ?? "").trim().toLowerCase();
  const tanlangan = qidiruv
    ? hammasi.filter(
        (a) =>
          a.nomi.toLowerCase().includes(qidiruv) ||
          (a.egaIsm ?? "").toLowerCase().includes(qidiruv)
      )
    : hammasi;

  return {
    jamiMatn: pulMatn(tanlangan.reduce((a, k) => a + k.qoldiq, 0)),
    kassalar: tanlangan.map((a) => ({
      nomi: a.egaIsm ? `${a.nomi} (${a.egaIsm})` : a.nomi,
      qoldiqMatn: pulMatn(a.qoldiq),
      turi: a.turi,
      faol: a.isActive,
    })),
    ...(qidiruv && tanlangan.length === 0
      ? { topilmadi: `"${nom}" nomli kassa topilmadi — mavjudlari: ${hammasi.map((a) => a.nomi).join(", ")}` }
      : {}),
    havolalar: [{ yorliq: "Kassalarni ko'rish", href: "/app/kassa" }],
  };
}

// ---------------------------------------------------------------------------
// 8. CRM
// ---------------------------------------------------------------------------

export interface CrmYakuni {
  davr: string;
  bosqichlar: Array<{ bosqich: string; turi: string; soni: number; summaMatn: string }>;
  davrdaYaratilgan: number;
  yutilgan: { soni: number; summaMatn: string };
  yoqotilgan: { soni: number; summaMatn: string };
  bugungiBuyurtmalar: number;
  havolalar: Havola[];
}

export async function crmYakuni(businessId: string, davr: Davr): Promise<CrmYakuni> {
  const bugun = dateOnlyStringToUTCDate(todayTashkentDateOnlyString());
  const [stages, davrdagi, bugungi] = await Promise.all([
    prisma.stage.findMany({
      where: { businessId },
      orderBy: { tartib: "asc" },
      include: { deals: { where: { deletedAt: null }, select: { summa: true } } },
    }),
    prisma.deal.findMany({
      where: { businessId, deletedAt: null, sana: { gte: davr.from, lt: davr.to } },
      select: { summa: true, stage: { select: { turi: true } } },
    }),
    prisma.deal.count({
      where: {
        businessId,
        deletedAt: null,
        sana: { gte: bugun, lt: new Date(bugun.getTime() + 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const kesim = (turi: string) => {
    const rows = davrdagi.filter((d) => d.stage.turi === turi);
    return { soni: rows.length, summaMatn: pulMatn(rows.reduce((a, d) => a + d.summa, 0)) };
  };

  return {
    davr: davr.nomi,
    bosqichlar: stages.map((s) => ({
      bosqich: s.nomi,
      turi: s.turi,
      soni: s.deals.length,
      summaMatn: pulMatn(s.deals.reduce((a, d) => a + d.summa, 0)),
    })),
    davrdaYaratilgan: davrdagi.length,
    yutilgan: kesim("WON"),
    yoqotilgan: kesim("LOST"),
    bugungiBuyurtmalar: bugungi,
    havolalar: [{ yorliq: "CRM'ni ochish", href: "/app/crm" }],
  };
}

// ---------------------------------------------------------------------------
// 9. Vazifalar
// ---------------------------------------------------------------------------

export interface VazifaYakuni {
  ochiq: number;
  jarayonda: number;
  bajarilgan: number;
  muddatiOtgan: number;
  bugungaBelgilangan: number;
  havolalar: Havola[];
}

export async function vazifaYakuni(businessId: string): Promise<VazifaYakuni> {
  const bugun = dateOnlyStringToUTCDate(todayTashkentDateOnlyString());
  const ertaga = new Date(bugun.getTime() + 24 * 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({
    where: { businessId, deletedAt: null },
    select: { holat: true, muddat: true },
  });
  const ochiqmi = (t: { holat: string }) => t.holat !== "BAJARILDI";

  return {
    ochiq: tasks.filter((t) => t.holat === "OCHIQ").length,
    jarayonda: tasks.filter((t) => t.holat === "JARAYONDA").length,
    bajarilgan: tasks.filter((t) => t.holat === "BAJARILDI").length,
    muddatiOtgan: tasks.filter((t) => ochiqmi(t) && t.muddat && t.muddat < bugun).length,
    bugungaBelgilangan: tasks.filter(
      (t) => ochiqmi(t) && t.muddat && t.muddat >= bugun && t.muddat < ertaga
    ).length,
    havolalar: [{ yorliq: "Vazifalarni ochish", href: "/app/vazifalar" }],
  };
}

// ---------------------------------------------------------------------------
// 10. Ombor va sotuv
// ---------------------------------------------------------------------------

export interface OmborYakuni {
  davr: string;
  turlarSoni: number;
  omborQiymatiMatn: string;
  davrdagiSotuvMatn: string;
  sotilganTurlari: number;
  qaytarilgan: { soni: number; summaMatn: string };
  engKopSotilgan: Array<{ mahsulot: string; miqdor: number; birlik: string; summaMatn: string }>;
  engKopSotilganKategoriya: Array<{ kategoriya: string; summaMatn: string }>;
  havolalar: Havola[];
}

export async function omborYakuni(businessId: string, davr: Davr): Promise<OmborYakuni> {
  const [stats, sotuv] = await Promise.all([
    getOmborStats(businessId),
    getSotuvStatistika(businessId, { from: davr.fromStr, to: davr.toStr }),
  ]);

  const mahsulotlar = sotuv.kategoriyalar
    .flatMap((k) => k.mahsulotlar)
    .sort((a, b) => b.summa - a.summa)
    .slice(0, 5);

  return {
    davr: davr.nomi,
    turlarSoni: stats.turlarSoni,
    omborQiymatiMatn: pulMatn(stats.omborQiymati),
    davrdagiSotuvMatn: pulMatn(sotuv.yakun.jamiSumma),
    sotilganTurlari: sotuv.yakun.mahsulotTurlari,
    qaytarilgan: {
      soni: sotuv.yakun.qaytarilgan.soni,
      summaMatn: pulMatn(sotuv.yakun.qaytarilgan.summa),
    },
    engKopSotilgan: mahsulotlar.map((m) => ({
      mahsulot: m.nomi,
      miqdor: m.miqdor,
      birlik: m.birlik,
      summaMatn: pulMatn(m.summa),
    })),
    engKopSotilganKategoriya: sotuv.kategoriyalar
      .slice()
      .sort((a, b) => b.summa - a.summa)
      .slice(0, 5)
      .map((k) => ({ kategoriya: k.nomi, summaMatn: pulMatn(k.summa) })),
    havolalar: [{ yorliq: "Omborni ochish", href: "/app/ombor" }],
  };
}

// ---------------------------------------------------------------------------
// 11. Mijozlar
// ---------------------------------------------------------------------------

export interface MijozYakuni {
  mijozlarSoni: number;
  engKopXaridQilgan: Array<{ mijoz: string; jamiSotuvMatn: string; sotuvSoni: number; ochiqQarzMatn: string }>;
  limitOshganlar: Array<{ mijoz: string; ochiqQarzMatn: string }>;
  havolalar: Havola[];
}

export async function mijozYakuni(businessId: string, limit = 5): Promise<MijozYakuni> {
  const mijozlar = await listMijozlar(businessId);
  const n = Math.min(10, Math.max(1, limit));
  return {
    mijozlarSoni: mijozlar.length,
    engKopXaridQilgan: mijozlar
      .slice()
      .sort((a, b) => b.jamiSotuv - a.jamiSotuv)
      .slice(0, n)
      .map((m) => ({
        mijoz: m.ism,
        jamiSotuvMatn: pulMatn(m.jamiSotuv),
        sotuvSoni: m.sotuvSoni,
        ochiqQarzMatn: pulMatn(m.ochiqQarz),
      })),
    limitOshganlar: mijozlar
      .filter((m) => m.limitToldi)
      .slice(0, n)
      .map((m) => ({ mijoz: m.ism, ochiqQarzMatn: pulMatn(m.ochiqQarz) })),
    havolalar: [{ yorliq: "Mijozlarni ochish", href: "/app/mijozlar" }],
  };
}
