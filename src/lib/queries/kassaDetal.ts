import { prisma } from "@/lib/prisma";
import { getAccountBalances, type AccountQoldiq } from "@/lib/queries/accounts";
import { getKassaSmenasi } from "@/lib/queries/kassaSmena";

/**
 * BITTA KASSANING DETALI — qoldiq, smena kesimi, davr kesimi va HARAKATLAR
 * TARIXI.
 *
 * Harakat — kassadagi pulni o'zgartirgan har qanday voqea. Uch manbadan
 * yig'iladi va bitta vaqt o'qiga tiziladi:
 *   1. kirim tranzaksiyalari (savdo, qarz to'lovi, boshqa kirim);
 *   2. chiqim tranzaksiyalari (xarajat);
 *   3. o'tkazmalar (kirgan va chiqqan).
 *
 * Faqat YAKUNLANGAN o'tkazmalar tarixga kiradi (`bajarildi` / `bekor`):
 * tasdiq kutayotgani hali pulni ko'chirmagan va alohida panelda ko'rinadi.
 *
 * ═══ JORIY SMENA ═══
 * `smenaKirim/smenaChiqim` — shu kassadan OXIRGI TOPSHIRISHDAN beri
 * (topshirilmagan kassada kun boshidan). Kassa topshirilgan zahoti bu
 * raqamlar 0 dan boshlanadi; tarix (pastdagi lenta) esa to'liq saqlanadi.
 * Batafsil: lib/queries/kassaSmena.ts.
 *
 * Davr `createdAt` bo'yicha kesiladi (yozuvning `sana` si emas) — kassadagi
 * pul yozuv qaysi kunga tegishli ekaniga emas, QACHON kiritilganiga qarab
 * harakatlanadi.
 */
export interface KassaHarakat {
  id: string;
  /** "kirim" | "chiqim" | "transfer-kirgan" | "transfer-chiqqan" */
  turi: string;
  /** Qoldiqqa ta'siri: musbat — qo'shildi, manfiy — ayrildi. */
  summa: number;
  /** Ekranda ko'rinadigan izoh: "Savdo", "Javlonga o'tkazildi", "Xarajat". */
  matn: string;
  /** Ikkinchi tomon (o'tkazmalarda) — "Javlon → Murod" ko'rinishi uchun. */
  qarshiTomon: string | null;
  vaqt: string;
}

/** Kassaga tushgan pulning to'lov turi bo'yicha taqsimoti (davr ichida). */
export interface TolovKesimi {
  /** "naqd" | "click" | "belgilanmagan". */
  tur: string;
  kirim: number;
  chiqim: number;
}

/** Davr ichidagi bitta o'tkazma qatori (topshirish yoki oddiy o'tkazma). */
export interface DetalTransfer {
  id: string;
  yonalish: "kirgan" | "chiqqan";
  qarshiTomon: string;
  summa: number;
  holat: string;
  turi: string;
  izoh: string | null;
  hisoblangan: number | null;
  farq: number | null;
  vaqt: string;
}

export interface KassaDetal {
  kassa: AccountQoldiq;
  /** Joriy smena boshi (ISO) va u topshirishdan boshlanadimi. */
  smenaBoshi: string;
  smenaTopshirishdan: boolean;
  /** Joriy smena kesimi — davr filtridan qat'i nazar (kartadagi raqam bilan bir xil). */
  smenaKirim: number;
  smenaChiqim: number;
  /** Tasdiq kutayotgan chiqim — hali kassada, lekin band. */
  kutilayotganChiqim: number;
  /** `qoldiq − kutilayotganChiqim` — xodim uchun "kassadagi pul". */
  mavjud: number;
  /** Tanlangan davr kesimi. */
  davrKirim: number;
  davrChiqim: number;
  tolovKesimi: TolovKesimi[];
  harakatlar: KassaHarakat[];
  /** Davr ichidagi topshirishlar (`turi = "smena"`). */
  topshirishlar: DetalTransfer[];
  /** Davr ichidagi oddiy o'tkazmalar. */
  otkazmalar: DetalTransfer[];
  /** Shu kassadan oxirgi yakunlangan topshirish (davrdan qat'i nazar). */
  oxirgiTopshirish: string | null;
}

export interface KassaDetalOpts {
  limit?: number;
  /** Davr boshi — `null`/berilmasa cheklov yo'q ("Barchasi"). */
  boshlanish?: Date | null;
  /** Davr oxiri (exclusive) — sana oralig'ida ishlatiladi. */
  tugash?: Date | null;
}

/** "naqd"/"click" berilmagan eski yozuvlar — kassa turidan chiqariladi. */
function tolovNomi(tolovTuri: string | null, kassaTuri: string): string {
  if (tolovTuri) return tolovTuri;
  return kassaTuri === "naqd" ? "naqd" : "click";
}

export async function getKassaDetal(
  businessId: string,
  accountId: string,
  opts: KassaDetalOpts | number = {}
): Promise<KassaDetal | null> {
  // Eski chaqiruv shakli (`limit` raqam) qo'llab-quvvatlanadi.
  const { limit = 50, boshlanish = null, tugash = null } =
    typeof opts === "number" ? { limit: opts } : opts;

  const davrFiltr =
    boshlanish || tugash
      ? { createdAt: { ...(boshlanish ? { gte: boshlanish } : {}), ...(tugash ? { lt: tugash } : {}) } }
      : {};

  const [qoldiqlar, smena, tranzaksiyalar, transferlar, oxirgi, kutilayotgan] = await Promise.all([
    getAccountBalances(businessId),
    getKassaSmenasi(businessId, accountId),
    prisma.transaction.findMany({
      where: { businessId, accountId, deletedAt: null, ...davrFiltr },
      select: {
        id: true,
        turi: true,
        summa: true,
        izoh: true,
        tolovTuri: true,
        createdAt: true,
        category: { select: { nomi: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.accountTransfer.findMany({
      where: {
        businessId,
        holat: { in: ["bajarildi", "bekor"] },
        OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
        ...davrFiltr,
      },
      include: {
        fromAccount: { select: { nomi: true } },
        toAccount: { select: { nomi: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.accountTransfer.findFirst({
      where: { businessId, fromAccountId: accountId, turi: "smena", holat: "bajarildi" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.accountTransfer.aggregate({
      where: { businessId, fromAccountId: accountId, holat: "kutilmoqda" },
      _sum: { summa: true },
    }),
  ]);

  const kassa = qoldiqlar.find((q) => q.id === accountId);
  if (!kassa) return null;

  // To'lov turi kesimi: "kassada turgan pul qaysi yo'l bilan keldi" —
  // naqd qo'lda, click terminalda. Yig'indi FAQAT ko'rsatilgan yozuvlardan
  // emas, davrning HAMMASIDAN bo'lishi uchun alohida guruhlanadi.
  const guruhlar = await prisma.transaction.groupBy({
    by: ["turi", "tolovTuri"],
    where: { businessId, accountId, deletedAt: null, ...davrFiltr },
    _sum: { summa: true },
  });
  const kesimMap = new Map<string, TolovKesimi>();
  for (const g of guruhlar) {
    const tur = tolovNomi(g.tolovTuri, kassa.turi);
    const bor = kesimMap.get(tur) ?? { tur, kirim: 0, chiqim: 0 };
    if (g.turi === "kirim") bor.kirim += g._sum.summa ?? 0;
    else bor.chiqim += g._sum.summa ?? 0;
    kesimMap.set(tur, bor);
  }
  const tolovKesimi = [...kesimMap.values()].filter((k) => k.kirim !== 0 || k.chiqim !== 0);

  const harakatlar: KassaHarakat[] = [
    ...tranzaksiyalar.map((t) => ({
      id: t.id,
      turi: t.turi,
      summa: t.turi === "kirim" ? t.summa : -t.summa,
      matn: t.izoh?.trim() || t.category?.nomi || (t.turi === "kirim" ? "Kirim" : "Chiqim"),
      qarshiTomon: null,
      vaqt: t.createdAt.toISOString(),
    })),
    ...transferlar.map((tr) => {
      const chiqqan = tr.fromAccountId === accountId;
      const qarshi = chiqqan ? tr.toAccount.nomi : tr.fromAccount.nomi;
      const topshirish = tr.turi === "smena";
      return {
        id: tr.id,
        turi: chiqqan ? "transfer-chiqqan" : "transfer-kirgan",
        summa: chiqqan ? -tr.summa : tr.summa,
        matn: chiqqan
          ? topshirish
            ? `Kassa topshirildi: ${qarshi}`
            : `${qarshi}ga o'tkazildi`
          : `${qarshi}dan qabul qilindi`,
        qarshiTomon: qarshi,
        vaqt: tr.createdAt.toISOString(),
      };
    }),
  ]
    .sort((a, b) => (a.vaqt < b.vaqt ? 1 : -1))
    .slice(0, limit);

  const detalTransfer = (tr: (typeof transferlar)[number]): DetalTransfer => {
    const chiqqan = tr.fromAccountId === accountId;
    return {
      id: tr.id,
      yonalish: chiqqan ? "chiqqan" : "kirgan",
      qarshiTomon: chiqqan
        ? (tr.toUserIsm ?? tr.toAccount.nomi)
        : (tr.fromUserIsm ?? tr.fromAccount.nomi),
      summa: tr.summa,
      holat: tr.holat,
      turi: tr.turi,
      izoh: tr.izoh,
      hisoblangan: tr.hisoblangan,
      farq: tr.farq,
      vaqt: tr.createdAt.toISOString(),
    };
  };

  const band = kutilayotgan._sum.summa ?? 0;
  return {
    kassa,
    smenaBoshi: smena.boshi.toISOString(),
    smenaTopshirishdan: smena.topshirishdan,
    smenaKirim: smena.kirim,
    smenaChiqim: smena.chiqim,
    kutilayotganChiqim: band,
    mavjud: kassa.qoldiq - band,
    davrKirim: tolovKesimi.reduce((a, k) => a + k.kirim, 0),
    davrChiqim: tolovKesimi.reduce((a, k) => a + k.chiqim, 0),
    tolovKesimi,
    harakatlar,
    topshirishlar: transferlar.filter((t) => t.turi === "smena").map(detalTransfer),
    otkazmalar: transferlar.filter((t) => t.turi !== "smena").map(detalTransfer),
    oxirgiTopshirish: oxirgi?.createdAt.toISOString() ?? null,
  };
}
