import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate, utcDateToDateOnlyString, TOSHKENT_OFFSET_MS } from "@/lib/date";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import { naqdChiqimmi } from "@/lib/services/smena";
import { QOLDIQ_HOLATLARI } from "@/lib/validation/account";

/**
 * KUNLIK HISOBOT o'qish so'rovlari. Faqat o'qish — yozish lib/services/kunlik.ts da.
 * Hammasi tenant-scoped `prisma` orqali (izolyatsiya avtomatik).
 */

export interface KunlikTushumDTO {
  id: string;
  summa: number;
  tolovTuri: string;
  izoh: string | null;
  userId: string;
  userIsm: string | null;
  /** Yozuvlar (Transaction) dan avtomatik ulangan bo'lsa true — kunlikda tahrirlanmaydi. */
  yozuvdan: boolean;
  /** ISO — kiritilgan vaqt (soat UI'da Toshkent bo'yicha ko'rsatiladi). */
  createdAt: string;
}

export type KunlikHolatDTO = "OPEN" | "SUBMITTED" | "CONFIRMED";

export interface KunlikReportDTO {
  id: string | null;
  /** "YYYY-MM-DD" */
  sana: string;
  holat: KunlikHolatDTO;
  naqdSumma: number;
  clickSumma: number;
  qarzSumma: number;
  jamiSumma: number;
  /** Shu kunning Yozuvlardagi chiqimlari jami (jonli hisoblanadi). */
  chiqimSumma: number;
  /** jamiSumma − chiqimSumma — kun yakunida ko'rsatiladigan SOF natija. */
  sofSumma: number;
  /** Kassa topshiruvi (pul nazorati). */
  submittedByIsm: string | null;
  submittedAt: string | null;
  /** Kassir SANAB topshirgan naqd. */
  sanalganNaqd: number | null;
  /**
   * TIZIM HISOBI — topshirish paytida muzlatilgan kassa qoldig'i.
   * Eski (migratsiyagacha) kunlarda null.
   */
  kutilganNaqd: number | null;
  /** sanalganNaqd − kutilganNaqd; topshirilmagan bo'lsa null. Manfiy = KAM. */
  naqdFarq: number | null;
  /** Kassirning topshirish izohi va direktorning qaror izohi. */
  izoh: string | null;
  qarorIzoh: string | null;
  /** Kun topshirig'ining pul harakati (AccountTransfer) IDsi — bo'lmasa null. */
  transferId: string | null;
  confirmedByIsm: string | null;
  confirmedAt: string | null;
  items: KunlikTushumDTO[];
}

function holatDTO(holat: string): KunlikHolatDTO {
  return holat === "CONFIRMED" ? "CONFIRMED" : holat === "SUBMITTED" ? "SUBMITTED" : "OPEN";
}

/**
 * Bitta kunning hisoboti tushumlari bilan. Hisobot hali ochilmagan bo'lsa
 * (kun boshlanmagan) — nol qiymatli "virtual" DTO qaytadi: yangi kun har doim
 * 0 so'mdan boshlanadi, yozuv esa birinchi tushumda yaratiladi.
 */
export async function getKunlikReport(businessId: string, sanaStr: string): Promise<KunlikReportDTO> {
  const sana = dateOnlyStringToUTCDate(sanaStr);
  // Chiqim kunlikda saqlanmaydi — Yozuvlardan (Transaction) jonli jamlanadi,
  // shuning uchun har doim haqiqiy holatni ko'rsatadi.
  const [report, chiqimAgg] = await Promise.all([
    prisma.dailyReport.findFirst({
      where: { businessId, sana },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.transaction.aggregate({
      _sum: { summa: true },
      where: { businessId, turi: "chiqim", deletedAt: null, sana },
    }),
  ]);
  const chiqimSumma = chiqimAgg._sum.summa ?? 0;
  if (!report) {
    return {
      id: null,
      sana: sanaStr,
      holat: "OPEN",
      naqdSumma: 0,
      clickSumma: 0,
      qarzSumma: 0,
      jamiSumma: 0,
      chiqimSumma,
      sofSumma: -chiqimSumma,
      submittedByIsm: null,
      submittedAt: null,
      sanalganNaqd: null,
      kutilganNaqd: null,
      naqdFarq: null,
      izoh: null,
      qarorIzoh: null,
      transferId: null,
      confirmedByIsm: null,
      confirmedAt: null,
      items: [],
    };
  }
  return {
    id: report.id,
    sana: utcDateToDateOnlyString(report.sana),
    holat: holatDTO(report.holat),
    naqdSumma: report.naqdSumma,
    clickSumma: report.clickSumma,
    qarzSumma: report.qarzSumma,
    jamiSumma: report.jamiSumma,
    chiqimSumma,
    sofSumma: report.jamiSumma - chiqimSumma,
    submittedByIsm: report.submittedByIsm,
    submittedAt: report.submittedAt ? report.submittedAt.toISOString() : null,
    sanalganNaqd: report.sanalganNaqd,
    kutilganNaqd: report.kutilganNaqd,
    // Farq MUZLATILGAN qiymatdan o'qiladi. Eski kunlarda u yo'q — o'sha
    // yerda avvalgi (naqd kirimga qarab) taqqoslash saqlanadi, aks holda
    // tarixdagi raqamlar "o'z-o'zidan" o'zgarib ketardi.
    naqdFarq:
      report.kassaFarq ??
      (report.sanalganNaqd === null ? null : report.sanalganNaqd - report.naqdSumma),
    izoh: report.izoh,
    qarorIzoh: report.qarorIzoh,
    transferId: report.transferId,
    confirmedByIsm: report.confirmedByIsm,
    confirmedAt: report.confirmedAt ? report.confirmedAt.toISOString() : null,
    items: report.items.map((t) => ({
      id: t.id,
      summa: t.summa,
      tolovTuri: t.tolovTuri,
      izoh: t.izoh,
      userId: t.userId,
      userIsm: t.userIsm,
      yozuvdan: !!t.transactionId,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export interface KunlikTarixDTO {
  id: string;
  sana: string;
  holat: KunlikHolatDTO;
  naqdSumma: number;
  clickSumma: number;
  qarzSumma: number;
  jamiSumma: number;
  /** Shu kunning Yozuvlardagi chiqimlari jami. */
  chiqimSumma: number;
  /** jamiSumma − chiqimSumma — kun sof natijasi. */
  sofSumma: number;
  /** Kassir topshirgan naqd (topshirilmagan bo'lsa null). */
  sanalganNaqd: number | null;
  /** Tizim hisobi (muzlatilgan) — eski kunlarda null. */
  kutilganNaqd: number | null;
  /** sanalganNaqd − kutilganNaqd; topshirilmagan bo'lsa null. */
  naqdFarq: number | null;
  submittedByIsm: string | null;
  confirmedByIsm: string | null;
}

/** Oxirgi kunlar tarixi (yangi kun birinchi). */
export async function listKunlikTarix(businessId: string, limit = 60): Promise<KunlikTarixDTO[]> {
  const rows = await prisma.dailyReport.findMany({
    where: { businessId },
    orderBy: { sana: "desc" },
    take: limit,
  });
  // Har kunning chiqimi Yozuvlardan BITTA groupBy bilan jamlanadi.
  const chiqimlar = rows.length
    ? await prisma.transaction.groupBy({
        by: ["sana"],
        where: {
          businessId,
          turi: "chiqim",
          deletedAt: null,
          sana: { in: rows.map((r) => r.sana) },
        },
        _sum: { summa: true },
      })
    : [];
  const chiqimMap = new Map(
    chiqimlar.map((c) => [utcDateToDateOnlyString(c.sana), c._sum.summa ?? 0])
  );
  return rows.map((r) => {
    const sana = utcDateToDateOnlyString(r.sana);
    const chiqimSumma = chiqimMap.get(sana) ?? 0;
    return {
      id: r.id,
      sana,
      holat: holatDTO(r.holat),
      naqdSumma: r.naqdSumma,
      clickSumma: r.clickSumma,
      qarzSumma: r.qarzSumma,
      jamiSumma: r.jamiSumma,
      chiqimSumma,
      sofSumma: r.jamiSumma - chiqimSumma,
      sanalganNaqd: r.sanalganNaqd,
      kutilganNaqd: r.kutilganNaqd,
      naqdFarq:
        r.kassaFarq ?? (r.sanalganNaqd === null ? null : r.sanalganNaqd - r.naqdSumma),
      submittedByIsm: r.submittedByIsm,
      confirmedByIsm: r.confirmedByIsm,
    };
  });
}

export interface KunlikDirektorDTO {
  direktorId: string | null;
  direktorIsm: string | null;
}

/** Biznes uchun tayinlangan direktor (bo'lsa). */
export async function getKunlikDirektor(businessId: string): Promise<KunlikDirektorDTO> {
  const sozlama = await prisma.dailyReportSetting.findFirst({
    where: { businessId },
    select: { direktorId: true },
  });
  if (!sozlama?.direktorId) return { direktorId: null, direktorIsm: null };
  const user = await prisma.user.findFirst({
    where: { id: sozlama.direktorId },
    select: { ism: true },
  });
  return { direktorId: sozlama.direktorId, direktorIsm: user?.ism ?? null };
}

export interface KunlikNomzodDTO {
  id: string;
  ism: string;
  rol: string;
}

/**
 * Direktorlikka nomzodlar: tenantdagi faol foydalanuvchilar — biznesga
 * biriktirilmaganlar (owner/admin/seller) yoki aynan shu biznesga
 * biriktirilganlar (kassir).
 */
export async function listKunlikNomzodlar(businessId: string): Promise<KunlikNomzodDTO[]> {
  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      rol: { in: ["OWNER", "ADMIN", "CASHIER", "SELLER"] },
      // Ko'p-bizneslik: biriktirilganlar + umuman biriktirilmaganlar.
      ...biznesXodimlariWhere(businessId),
    },
    select: { id: true, ism: true, rol: true },
    orderBy: { ism: "asc" },
  });
  return rows;
}

// ---------------------------------------------------------------------------
// KASSA HOLATI — "Kassada bo'lishi kerak" raqamining JONLI ko'rinishi.
//
// Manbasi bitta: ledger (Transaction + AccountTransfer). Xizmat qatlamidagi
// `topshiruvchiKassaTx` bilan AYNAN bir xil formula — u tranzaksiya ichida,
// bu esa sahifa uchun. Ikki xil hisob bo'lsa UI va topshiriq raqamlari
// ajralib ketardi.
// ---------------------------------------------------------------------------

/** NAQD kassa filtri — jismoniy pul faqat shu turdagi kassalarda yotadi. */
const NAQD_KASSA = { turi: "naqd" } as const;

export interface KunlikKassaDTO {
  /** Kassa qoldig'i — topshirilishi kerak bo'lgan naqd. */
  qoldiq: number;
  /** Pul aynan foydalanuvchining shaxsiy kassasidami. */
  shaxsiy: boolean;
  /** Shaxsiy kassa nomi (bo'lsa). */
  kassaNomi: string | null;
  /** Tasdiq kutayotgan chiqim (topshirilgan, lekin hali qabul qilinmagan). */
  kutilayotgan: number;
}

async function kassaQoldiq(businessId: string, accountId: string): Promise<number> {
  const [kirim, chiqim, kirgan, chiqqan] = await Promise.all([
    prisma.transaction.aggregate({
      where: { businessId, accountId, turi: "kirim", deletedAt: null },
      _sum: { summa: true },
    }),
    prisma.transaction.aggregate({
      where: { businessId, accountId, turi: "chiqim", deletedAt: null },
      _sum: { summa: true },
    }),
    prisma.accountTransfer.aggregate({
      where: { businessId, toAccountId: accountId, holat: { in: [...QOLDIQ_HOLATLARI] } },
      _sum: { summa: true },
    }),
    prisma.accountTransfer.aggregate({
      where: { businessId, fromAccountId: accountId, holat: { in: [...QOLDIQ_HOLATLARI] } },
      _sum: { summa: true },
    }),
  ]);
  return (
    (kirim._sum.summa ?? 0) -
    (chiqim._sum.summa ?? 0) +
    (kirgan._sum.summa ?? 0) -
    (chiqqan._sum.summa ?? 0)
  );
}

/**
 * Foydalanuvchining topshiradigan kassasi. Shaxsiy kassa yo'q bo'lsa —
 * biznesning jami naqdi (u holda pul ko'chirilmaydi, faqat solishtiriladi).
 */
export async function getKunlikKassa(businessId: string, userId: string): Promise<KunlikKassaDTO> {
  const shaxsiy = await prisma.account.findFirst({
    where: { businessId, userId, isActive: true },
    select: { id: true, nomi: true },
    orderBy: { createdAt: "asc" },
  });

  if (shaxsiy) {
    const [qoldiq, kutilayotgan] = await Promise.all([
      kassaQoldiq(businessId, shaxsiy.id),
      prisma.accountTransfer.aggregate({
        where: { businessId, fromAccountId: shaxsiy.id, holat: "kutilmoqda" },
        _sum: { summa: true },
      }),
    ]);
    return {
      qoldiq,
      shaxsiy: true,
      kassaNomi: shaxsiy.nomi,
      kutilayotgan: kutilayotgan._sum.summa ?? 0,
    };
  }

  const [kirim, chiqim, kirgan, chiqqan] = await Promise.all([
    prisma.transaction.aggregate({
      where: { businessId, turi: "kirim", deletedAt: null, account: NAQD_KASSA },
      _sum: { summa: true },
    }),
    prisma.transaction.aggregate({
      where: { businessId, turi: "chiqim", deletedAt: null, account: NAQD_KASSA },
      _sum: { summa: true },
    }),
    prisma.accountTransfer.aggregate({
      where: { businessId, holat: { in: [...QOLDIQ_HOLATLARI] }, toAccount: NAQD_KASSA },
      _sum: { summa: true },
    }),
    prisma.accountTransfer.aggregate({
      where: { businessId, holat: { in: [...QOLDIQ_HOLATLARI] }, fromAccount: NAQD_KASSA },
      _sum: { summa: true },
    }),
  ]);
  return {
    qoldiq:
      (kirim._sum.summa ?? 0) -
      (chiqim._sum.summa ?? 0) +
      (kirgan._sum.summa ?? 0) -
      (chiqqan._sum.summa ?? 0),
    shaxsiy: false,
    kassaNomi: null,
    kutilayotgan: 0,
  };
}

// ---------------------------------------------------------------------------
// BUGUNGI OPERATSIYALAR — kun lentasi.
//
// Ikki TURDAGI qator ATAYLAB ajratiladi:
//   - "kirim"/"chiqim" — BIZNES TRANZAKSIYASI, Jami Kirim/Chiqimga kiradi;
//   - "kochish"        — ICHKI PUL HARAKATI (kassa topshirish), hisobotga
//                        KIRMAYDI, faqat kassa egasi almashadi.
// UI ularni turlicha ko'rsatadi — foydalanuvchi "7 mln topshirildi"ni
// yangi kirim deb o'ylamasligi uchun.
// ---------------------------------------------------------------------------

export type KunlikOperatsiyaTuri = "kirim" | "chiqim" | "kochish";

export interface KunlikOperatsiyaDTO {
  id: string;
  turi: KunlikOperatsiyaTuri;
  summa: number;
  /** Kategoriya nomi yoki ko'chirish yo'nalishi. */
  sarlavha: string;
  /** "Naqd" | "Click" | "Qarz" — ko'chirishda null. */
  tolov: string | null;
  izoh: string | null;
  kim: string | null;
  /** ISO — soat UI'da Toshkent bo'yicha ko'rsatiladi. */
  vaqt: string;
  /** Ichki ko'chirish holati: "kutilmoqda" | "bajarildi" | "rad" | "bekor". */
  holat: string | null;
}

const TOLOV_NOMI: Record<string, string> = { naqd: "Naqd", click: "Click", qarz: "Qarz" };

/** Kassa turidan to'lov nomi — to'lov turi ko'rsatilmagan eski yozuvlar uchun. */
function tolovNomi(tolovTuri: string | null, kassaTuri: string | null): string {
  if (tolovTuri) return TOLOV_NOMI[tolovTuri] ?? tolovTuri;
  return naqdChiqimmi(null, kassaTuri) ? "Naqd" : "Click";
}

/**
 * Bir kunning operatsiyalari (eng yangisi birinchi).
 *
 * Yozuvlar `sana` bo'yicha (hisobot bilan bir xil kesim), pul ko'chishlari
 * esa Toshkent kun oynasi bo'yicha olinadi — ko'chirish kalendar sanaga
 * emas, haqiqiy paytga bog'liq.
 */
export async function listKunlikOperatsiyalar(
  businessId: string,
  sanaStr: string,
  limit = 100
): Promise<KunlikOperatsiyaDTO[]> {
  const sana = dateOnlyStringToUTCDate(sanaStr);
  const kunBoshi = new Date(sana.getTime() - TOSHKENT_OFFSET_MS);
  const kunOxiri = new Date(kunBoshi.getTime() + 24 * 60 * 60 * 1000);

  const [yozuvlar, kochishlar] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessId, deletedAt: null, sana },
      select: {
        id: true,
        turi: true,
        summa: true,
        tolovTuri: true,
        izoh: true,
        createdAt: true,
        category: { select: { nomi: true } },
        account: { select: { turi: true } },
        user: { select: { ism: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.accountTransfer.findMany({
      where: { businessId, sana: { gte: kunBoshi, lt: kunOxiri } },
      select: {
        id: true,
        summa: true,
        izoh: true,
        sana: true,
        holat: true,
        turi: true,
        fromUserIsm: true,
        toUserIsm: true,
        fromAccount: { select: { nomi: true } },
        toAccount: { select: { nomi: true } },
      },
      orderBy: { sana: "desc" },
      take: limit,
    }),
  ]);

  const qatorlar: KunlikOperatsiyaDTO[] = [
    ...yozuvlar.map((t) => ({
      id: t.id,
      turi: (t.turi === "kirim" ? "kirim" : "chiqim") as KunlikOperatsiyaTuri,
      summa: t.summa,
      sarlavha: t.category?.nomi ?? "—",
      tolov: tolovNomi(t.tolovTuri, t.account?.turi ?? null),
      izoh: t.izoh,
      kim: t.user?.ism ?? null,
      vaqt: t.createdAt.toISOString(),
      holat: null,
    })),
    ...kochishlar.map((k) => ({
      id: k.id,
      turi: "kochish" as KunlikOperatsiyaTuri,
      summa: k.summa,
      sarlavha:
        k.turi === "smena"
          ? `Kassa topshirildi: ${k.fromUserIsm ?? k.fromAccount?.nomi ?? "—"} → ${
              k.toUserIsm ?? k.toAccount?.nomi ?? "—"
            }`
          : `Pul ko'chirildi: ${k.fromAccount?.nomi ?? "—"} → ${k.toAccount?.nomi ?? "—"}`,
      tolov: null,
      izoh: k.izoh,
      kim: k.fromUserIsm,
      vaqt: k.sana.toISOString(),
      holat: k.holat,
    })),
  ];

  return qatorlar.sort((a, b) => (a.vaqt < b.vaqt ? 1 : -1)).slice(0, limit);
}

// ---------------------------------------------------------------------------
// DIREKTOR PANELI — tasdiq kutayotgan kunlar.
// ---------------------------------------------------------------------------

export interface KutilayotganKunDTO {
  sana: string;
  jamiSumma: number;
  chiqimSumma: number;
  sofSumma: number;
  kutilganNaqd: number | null;
  sanalganNaqd: number | null;
  naqdFarq: number | null;
  izoh: string | null;
  submittedByIsm: string | null;
  submittedAt: string | null;
}

/** Topshirilgan, lekin hali tasdiqlanmagan kunlar (eng eskisi birinchi). */
export async function listKutilayotganKunlar(
  businessId: string,
  limit = 20
): Promise<KutilayotganKunDTO[]> {
  const rows = await prisma.dailyReport.findMany({
    where: { businessId, holat: "SUBMITTED" },
    orderBy: { sana: "asc" },
    take: limit,
  });
  if (rows.length === 0) return [];

  const chiqimlar = await prisma.transaction.groupBy({
    by: ["sana"],
    where: { businessId, turi: "chiqim", deletedAt: null, sana: { in: rows.map((r) => r.sana) } },
    _sum: { summa: true },
  });
  const chiqimMap = new Map(
    chiqimlar.map((c) => [utcDateToDateOnlyString(c.sana), c._sum.summa ?? 0])
  );

  return rows.map((r) => {
    const sana = utcDateToDateOnlyString(r.sana);
    const chiqimSumma = chiqimMap.get(sana) ?? 0;
    return {
      sana,
      jamiSumma: r.jamiSumma,
      chiqimSumma,
      sofSumma: r.jamiSumma - chiqimSumma,
      kutilganNaqd: r.kutilganNaqd,
      sanalganNaqd: r.sanalganNaqd,
      naqdFarq:
        r.kassaFarq ?? (r.sanalganNaqd === null ? null : r.sanalganNaqd - r.naqdSumma),
      izoh: r.izoh,
      submittedByIsm: r.submittedByIsm,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    };
  });
}

/** "Tushum kiritish" formasi uchun kirim kategoriyalari. */
export async function listKunlikKategoriyalar(
  businessId: string
): Promise<{ id: string; nomi: string }[]> {
  return prisma.category.findMany({
    where: { businessId, turi: "kirim", isActive: true },
    select: { id: true, nomi: true },
    orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
  });
}
