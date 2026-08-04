import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessQueryRaw, businessScope, songa } from "@/lib/db/businessRaw";

export interface AccountDTO {
  id: string;
  nomi: string;
  turi: string;
  isActive: boolean;
  tartib: number;
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
    orderBy: [{ isActive: "desc" }, { tartib: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((a) => ({
    id: a.id,
    nomi: a.nomi,
    turi: a.turi,
    isActive: a.isActive,
    tartib: a.tartib,
  }));
}

/**
 * Har kassaning joriy qoldig'i.
 *
 * Qoldiq = kirim − chiqim + kirgan transferlar − chiqqan transferlar.
 * Transferlar ATAYLAB tranzaksiya yozmaydi (bu kirim ham, chiqim ham emas),
 * shuning uchun ular shu yerda alohida qo'shiladi.
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
      GROUP BY t."accountId", t."turi"
    `),
    businessQueryRaw<{ fromAccountId: string; toAccountId: string; summa: unknown }>(Prisma.sql`
      SELECT tr."fromAccountId" AS fromAccountId, tr."toAccountId" AS toAccountId, SUM(tr."summa") AS summa
      FROM "AccountTransfer" tr
      JOIN "Business" b ON b."id" = tr."businessId"
      WHERE ${businessScope("tr", businessId)}
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

/** Biznesning jami kassa qoldig'i (dashboard kartasi uchun). */
export async function getJamiKassaQoldiq(businessId: string): Promise<number> {
  const qoldiqlar = await getAccountBalances(businessId);
  return qoldiqlar.reduce((a, q) => a + q.qoldiq, 0);
}

export interface TransferDTO {
  id: string;
  fromNomi: string;
  toNomi: string;
  summa: number;
  sana: string;
  izoh: string | null;
}

export async function listTransfers(businessId: string, limit = 50): Promise<TransferDTO[]> {
  const rows = await prisma.accountTransfer.findMany({
    where: { businessId },
    include: { fromAccount: { select: { nomi: true } }, toAccount: { select: { nomi: true } } },
    orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((t) => ({
    id: t.id,
    fromNomi: t.fromAccount.nomi,
    toNomi: t.toAccount.nomi,
    summa: t.summa,
    sana: t.sana.toISOString(),
    izoh: t.izoh,
  }));
}
