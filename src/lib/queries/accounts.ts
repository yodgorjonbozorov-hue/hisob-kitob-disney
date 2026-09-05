import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessQueryRaw, businessScope, songa } from "@/lib/db/businessRaw";
import { QARZ_EMAS, qarzEmasSql } from "@/lib/qarzFiltr";
import { getKassaSmenasi } from "@/lib/queries/kassaSmena";

export interface AccountDTO {
  id: string;
  nomi: string;
  turi: string;
  isActive: boolean;
  tartib: number;
  /** Shaxsiy kassa egasi (PRO) — null bo'lsa umumiy biznes kassasi. */
  userId: string | null;
  egaIsm: string | null;
}

export interface AccountQoldiq extends AccountDTO {
  /** Shu kassaga tushgan kirimlar. */
  kirim: number;
  /** Shu kassadan chiqqan chiqimlar. */
  chiqim: number;
  /** Boshqa kassalardan ko'chirilgan pul. */
  kirganTransfer: number;
  /** Boshqa kassalarga ko'chirilgan pul. */
  chiqqanTransfer: number;
  /** kirim − chiqim + kirganTransfer − chiqqanTransfer */
  qoldiq: number;
}

export async function listAccounts(businessId: string, faqatFaol = false): Promise<AccountDTO[]> {
  const rows = await prisma.account.findMany({
    where: { businessId, ...(faqatFaol ? { isActive: true } : {}) },
    include: { user: { select: { ism: true } } },
    orderBy: [{ isActive: "desc" }, { tartib: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((a) => ({
    id: a.id,
    nomi: a.nomi,
    turi: a.turi,
    isActive: a.isActive,
    tartib: a.tartib,
    userId: a.userId,
    egaIsm: a.user?.ism ?? null,
  }));
}

/**
 * Har kassaning joriy qoldig'i.
 *
 * Qoldiq = kirim − chiqim + kirgan transferlar − chiqqan transferlar.
 * Transferlar ATAYLAB tranzaksiya yozmaydi (bu kirim ham, chiqim ham emas),
 * shuning uchun ular shu yerda alohida qo'shiladi.
 *
 * QARZ FILTRI SHART: qarzga yozilgan kirim pul emas (pul kassaga tushmagan),
 * shuning uchun u qoldiqqa kirmaydi. Yozish qatlami bunday yozuvni kassaga
 * bog'lamaydi (`accountId = null`), lekin eski migratsiya bog'lab qo'ygan
 * bo'lishi mumkin — filtr shunday yozuv kassani soxta shishirmasin uchun.
 *
 * Uchala agregat bitta so'rovda yig'ilmaydi (uch xil jadval), lekin har biri
 * BITTA `GROUP BY` — kassalar soni qancha bo'lsa ham 3 ta so'rov.
 */
export async function getAccountBalances(businessId: string): Promise<AccountQoldiq[]> {
  const [accounts, tranzaksiyalar, transferlar] = await Promise.all([
    listAccounts(businessId),
    businessQueryRaw<{ accountId: string | null; turi: string; summa: unknown }>(Prisma.sql`
      SELECT t."accountId" AS accountId, t."turi" AS turi, SUM(t."summa") AS summa
      FROM "Transaction" t
      JOIN "Business" b ON b."id" = t."businessId"
      WHERE ${businessScope("t", businessId)} AND t."deletedAt" IS NULL
        AND ${qarzEmasSql("t")}
      GROUP BY t."accountId", t."turi"
    `),
    // Qoldiqqa faqat haqiqatda ko'chgan pul kiradi: "kutilmoqda" hali qabul
    // qilinmagan, "rad" esa umuman ko'chmagan (lib/validation/account.ts).
    businessQueryRaw<{ fromAccountId: string; toAccountId: string; summa: unknown }>(Prisma.sql`
      SELECT tr."fromAccountId" AS fromAccountId, tr."toAccountId" AS toAccountId, SUM(tr."summa") AS summa
      FROM "AccountTransfer" tr
      JOIN "Business" b ON b."id" = tr."businessId"
      WHERE ${businessScope("tr", businessId)} AND tr."holat" IN ('bajarildi', 'bekor')
      GROUP BY tr."fromAccountId", tr."toAccountId"
    `),
  ]);

  const bosh = () => ({ kirim: 0, chiqim: 0, kirganTransfer: 0, chiqqanTransfer: 0 });
  const map = new Map(accounts.map((a) => [a.id, bosh()]));

  for (const r of tranzaksiyalar) {
    // accountId null — eski (migratsiyagacha) yozuvlar; ular hech qaysi
    // kassaga tegishli emas va qoldiqqa kirmaydi (scripts/kassa-migratsiya.ts).
    if (!r.accountId) continue;
    const q = map.get(r.accountId);
    if (!q) continue;
    if (r.turi === "kirim") q.kirim += songa(r.summa);
    else q.chiqim += songa(r.summa);
  }

  for (const r of transferlar) {
    const summa = songa(r.summa);
    const chiqqan = map.get(r.fromAccountId);
    if (chiqqan) chiqqan.chiqqanTransfer += summa;
    const kirgan = map.get(r.toAccountId);
    if (kirgan) kirgan.kirganTransfer += summa;
  }

  return accounts.map((a) => {
    const q = map.get(a.id) ?? bosh();
    return {
      ...a,
      ...q,
      qoldiq: q.kirim - q.chiqim + q.kirganTransfer - q.chiqqanTransfer,
    };
  });
}

/** Bir kassaning bir kunlik kesimi (dashboard kartasi: "Bugungi savdo"). */
export interface KassaKunlik {
  kirim: number;
  chiqim: number;
}

/**
 * HAR KASSANING BUGUNGI KIRIM/CHIQIMI.
 *
 * Yozuvning `sana` si emas, `createdAt` i bo'yicha kesiladi: kassadagi pul
 * yozuv qaysi kunga tegishli ekaniga emas, QACHON kiritilganiga qarab
 * to'planadi (smena hisobi bilan bir xil qoida — lib/services/smena.ts).
 * Qarzga yozilgan kirim kassaga tushmagan — qoldiq hisobi bilan bir xil
 * filtr bilan chiqarib tashlanadi.
 */
export async function getKassaKunlik(
  businessId: string,
  boshlanish: Date
): Promise<Map<string, KassaKunlik>> {
  const rows = await prisma.transaction.groupBy({
    by: ["accountId", "turi"],
    where: { businessId, deletedAt: null, createdAt: { gte: boshlanish }, ...QARZ_EMAS },
    _sum: { summa: true },
  });
  const natija = new Map<string, KassaKunlik>();
  for (const r of rows) {
    if (!r.accountId) continue;
    const kesim = natija.get(r.accountId) ?? { kirim: 0, chiqim: 0 };
    if (r.turi === "kirim") kesim.kirim += r._sum.summa ?? 0;
    else kesim.chiqim += r._sum.summa ?? 0;
    natija.set(r.accountId, kesim);
  }
  return natija;
}

/** Bir kassaga bir kunda KIRGAN va undan CHIQQAN o'tkazmalar. */
export interface KassaKunlikTransfer {
  kirgan: number;
  chiqqan: number;
}

/**
 * HAR KASSANING BUGUNGI O'TKAZMA HARAKATI.
 *
 * Bu kirim/chiqim EMAS — biznesning savdo va xarajat raqamlariga umuman
 * qo'shilmaydi. Lekin BITTA kassaning qoldig'ini o'zgartiradi, shuning uchun
 * "kassada bugun nima bo'ldi" savoliga javob berish uchun alohida ko'rsatiladi.
 * Aks holda kassir "bugungi kirim 5 mln edi, qoldiq nega 2 mln" deb qolardi.
 */
export async function getKassaKunlikTransfer(
  businessId: string,
  boshlanish: Date
): Promise<Map<string, KassaKunlikTransfer>> {
  const rows = await prisma.accountTransfer.groupBy({
    by: ["fromAccountId", "toAccountId"],
    where: { businessId, holat: "bajarildi", createdAt: { gte: boshlanish } },
    _sum: { summa: true },
  });
  const natija = new Map<string, KassaKunlikTransfer>();
  const olish = (id: string) => {
    const bor = natija.get(id) ?? { kirgan: 0, chiqqan: 0 };
    natija.set(id, bor);
    return bor;
  };
  for (const r of rows) {
    const summa = r._sum.summa ?? 0;
    olish(r.fromAccountId).chiqqan += summa;
    olish(r.toAccountId).kirgan += summa;
  }
  return natija;
}

/** "Mening kassam" ixcham kartasi uchun — ledgerdan. */
export interface MeningKassam {
  accountId: string;
  nomi: string;
  /** Ledger qoldig'i (tasdiq kutayotgan topshirish hali ichida). */
  qoldiq: number;
  /** Tasdiq kutayotgan chiqim (topshirilgan, hali qabul qilinmagan). */
  kutilayotganChiqim: number;
  /** `qoldiq − kutilayotganChiqim` — xodim qo'lidagi HAQIQIY pul. */
  mavjud: number;
  /** Joriy smena (oxirgi topshirishdan beri) kirimi va chiqimi. */
  smenaKirim: number;
  smenaChiqim: number;
  /** Joriy smena boshi (ISO) va u topshirishdan boshlanadimi. */
  smenaBoshi: string;
  smenaTopshirishdan: boolean;
  /** Menga yuborilgan, hali qabul qilinmagan o'tkazmalar soni. */
  kutilayotganSoni: number;
}

/**
 * Joriy foydalanuvchining shaxsiy kassasi.
 *
 * `null` — shaxsiy kassa ochilmagan (rejim yoqilmagan): u holda xodimning
 * naqdi umumiy kassaga tushadi va alohida karta ko'rsatishning ma'nosi yo'q.
 *
 * Kirim/chiqim JORIY SMENA bo'yicha — kassa topshirilgan zahoti 0 dan
 * boshlanadi (lib/queries/kassaSmena.ts). Boshqa kassalarning qoldig'i bu
 * yerdan chiqmaydi: faqat o'z kassasi qaytariladi.
 */
export async function getMeningKassam(
  businessId: string,
  userId: string
): Promise<MeningKassam | null> {
  const qoldiqlar = await getAccountBalances(businessId);
  const meniki = qoldiqlar.find((q) => q.userId === userId && q.isActive);
  if (!meniki) return null;

  const [smena, kutilayotgan, band] = await Promise.all([
    getKassaSmenasi(businessId, meniki.id),
    prisma.accountTransfer.count({
      where: { businessId, holat: "kutilmoqda", toUserId: userId },
    }),
    prisma.accountTransfer.aggregate({
      where: { businessId, fromAccountId: meniki.id, holat: "kutilmoqda" },
      _sum: { summa: true },
    }),
  ]);
  const kutilayotganChiqim = band._sum.summa ?? 0;

  return {
    accountId: meniki.id,
    nomi: meniki.nomi,
    qoldiq: meniki.qoldiq,
    kutilayotganChiqim,
    mavjud: meniki.qoldiq - kutilayotganChiqim,
    smenaKirim: smena.kirim,
    smenaChiqim: smena.chiqim,
    smenaBoshi: smena.boshi.toISOString(),
    smenaTopshirishdan: smena.topshirishdan,
    kutilayotganSoni: kutilayotgan,
  };
}

/** Biznesning jami kassa qoldig'i (dashboard kartasi uchun). */
export async function getJamiKassaQoldiq(businessId: string): Promise<number> {
  const qoldiqlar = await getAccountBalances(businessId);
  return qoldiqlar.reduce((a, q) => a + q.qoldiq, 0);
}

export interface TransferDTO {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromNomi: string;
  toNomi: string;
  summa: number;
  sana: string;
  izoh: string | null;
  /** User-to-user o'tkazma bo'lsa — kim kimga (ism snapshotlari). */
  fromUserIsm: string | null;
  toUserIsm: string | null;
  fromUserId: string | null;
  toUserId: string | null;
  /** "transfer" | "smena". */
  turi: string;
  /** "bajarildi" | "kutilmoqda" | "rad" | "bekor". */
  holat: string;
  /** Qaror qabul qilgan (tasdiqlagan yoki rad etgan) foydalanuvchi. */
  tasdiqlaganId: string | null;
  tasdiqlaganIsm: string | null;
  qarorIzoh: string | null;
  /** Topshirish paytidagi TIZIM qoldig'i (faqat `turi = "smena"` da). */
  hisoblangan: number | null;
  /** `summa − hisoblangan` — kassa farqi. Manfiy = kamomad. */
  farq: number | null;
  createdAt: string;
}

const TRANSFER_INCLUDE = {
  fromAccount: { select: { nomi: true } },
  toAccount: { select: { nomi: true } },
} as const;

type TransferRow = Prisma.AccountTransferGetPayload<{ include: typeof TRANSFER_INCLUDE }>;

function transferDto(t: TransferRow): TransferDTO {
  return {
    id: t.id,
    fromAccountId: t.fromAccountId,
    toAccountId: t.toAccountId,
    fromNomi: t.fromAccount.nomi,
    toNomi: t.toAccount.nomi,
    summa: t.summa,
    sana: t.sana.toISOString(),
    izoh: t.izoh,
    fromUserIsm: t.fromUserIsm,
    toUserIsm: t.toUserIsm,
    fromUserId: t.fromUserId,
    toUserId: t.toUserId,
    turi: t.turi,
    holat: t.holat,
    tasdiqlaganId: t.tasdiqlaganId,
    tasdiqlaganIsm: t.tasdiqlaganIsm,
    qarorIzoh: t.qarorIzoh,
    hisoblangan: t.hisoblangan,
    farq: t.farq,
    createdAt: t.createdAt.toISOString(),
  };
}

export async function listTransfers(businessId: string, limit = 50): Promise<TransferDTO[]> {
  const rows = await prisma.accountTransfer.findMany({
    where: { businessId },
    include: TRANSFER_INCLUDE,
    orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(transferDto);
}

/**
 * KASSA HARAKATLARI RO'YXATI — davr bo'yicha kesilgan.
 *
 * `kutilmoqda` ATAYLAB chiqarib tashlanadi: hali pul ko'chmagan va u
 * "Kutilayotgan topshirishlar" panelida harakat talab qilib turibdi —
 * ikkinchi marta tarixda ko'rsatilsa bir voqea ikki joyda ko'rinardi.
 *
 * Davr `createdAt` bo'yicha kesiladi (`sana` emas) — kassadagi pul yozuv
 * qaysi kunga tegishli ekaniga emas, QACHON kiritilganiga qarab harakatlanadi.
 */
export async function listKassaHarakatlari(
  businessId: string,
  boshlanish: Date | null,
  limit = 50
): Promise<TransferDTO[]> {
  const rows = await prisma.accountTransfer.findMany({
    where: {
      businessId,
      holat: { not: "kutilmoqda" },
      ...(boshlanish ? { createdAt: { gte: boshlanish } } : {}),
    },
    include: TRANSFER_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(transferDto);
}

/**
 * TASDIQ KUTAYOTGAN O'TKAZMALAR.
 *
 * Bu ro'yxat harakat talab qiladi, shuning uchun u qoldiqlar bilan bir
 * so'rovda emas, alohida olinadi va panelda tepada ko'rsatiladi.
 */
export async function listKutilayotganTransferlar(
  businessId: string,
  limit = 50,
  /**
   * KASSA MAXFIYLIGI: berilsa faqat shu foydalanuvchi YUBORGAN yoki UNGA
   * yuborilgan o'tkazmalar qaytadi — boshqa xodimlar orasidagi summalar
   * "kassa.jami" huquqisiz ko'rinmaydi.
   */
  faqatUserId?: string | null
): Promise<TransferDTO[]> {
  const rows = await prisma.accountTransfer.findMany({
    where: {
      businessId,
      holat: "kutilmoqda",
      ...(faqatUserId ? { OR: [{ fromUserId: faqatUserId }, { toUserId: faqatUserId }] } : {}),
    },
    include: TRANSFER_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(transferDto);
}

/**
 * KASSA TOPSHIRISHLARI — direktorning "Kassa qabul qilish" sahifasi uchun.
 *
 * Faqat `turi = "smena"` qatorlari: oddiy pul o'tkazmalari bu ro'yxatga
 * tushmaydi (ular Kassalar sahifasidagi harakatlar lentasida). Topshirish
 * bu yerda IKKI bo'lakda ko'rsatiladi — qabul kutayotganlar (harakat talab
 * qiladi) va tarix (qabul qilingan/rad etilgan).
 *
 * `holatlar` berilmasa hammasi qaytadi. Tenant izolyatsiyasi — scoped
 * `prisma` va `businessId` sharti (sahifa aktiv biznes bilan chaqiradi).
 */
export async function listTopshirishlar(
  businessId: string,
  holatlar: string[] | null,
  limit = 50
): Promise<TransferDTO[]> {
  const rows = await prisma.accountTransfer.findMany({
    where: {
      businessId,
      turi: "smena",
      ...(holatlar ? { holat: { in: holatlar } } : {}),
    },
    include: TRANSFER_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(transferDto);
}

/** Berilgan kundan boshlab yakunlangan o'tkazmalar (direktor paneli: "bugungi transferlar"). */
export async function listTransferlarKundan(
  businessId: string,
  boshlanish: Date,
  limit = 50
): Promise<TransferDTO[]> {
  const rows = await prisma.accountTransfer.findMany({
    where: { businessId, holat: "bajarildi", createdAt: { gte: boshlanish } },
    include: TRANSFER_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(transferDto);
}
