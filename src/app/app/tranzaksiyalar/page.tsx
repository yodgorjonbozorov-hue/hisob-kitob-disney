import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId, getAccessibleBusinesses } from "@/lib/business";
import { isManager } from "@/lib/auth/roles";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { listTransactions } from "@/lib/queries/transactions";
import { formatSom } from "@/lib/format";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import { TransactionsClient } from "./TransactionsClient";
import { listAccounts } from "@/lib/queries/accounts";
import type { Prisma } from "@prisma/client";

interface SearchParams {
  from?: string;
  to?: string;
  turi?: string;
  categoryId?: string;
  q?: string;
  minSumma?: string;
  maxSumma?: string;
  page?: string;
}

export default async function TranzaksiyalarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { session, tenantId } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  const businessId = await resolveActiveBusinessId(session);
  // Sotuvchi kirim ham, chiqim ham qo'shadi/ko'radi — faqat "Sof foyda" ko'rsatkichi yashirin.
  const hideProfit = session.rol === "SELLER";

  if (!businessId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-fg">Tranzaksiyalar</h1>
        <p className="text-muted">Sizga biznes biriktirilmagan. Admin bilan bog'laning.</p>
      </div>
    );
  }

  const [result, categories, accounts, masullar] = await Promise.all([
    listTransactions({
      businessId,
      // Xodim faqat o'zi kiritgan yozuvlarni ko'radi, direktor — barchasini.
      userId: transactionScopeUserId(session),
      from: searchParams.from,
      to: searchParams.to,
      turi: searchParams.turi,
      categoryId: searchParams.categoryId,
      q: searchParams.q,
      minSumma: searchParams.minSumma ? parseInt(searchParams.minSumma, 10) : null,
      maxSumma: searchParams.maxSumma ? parseInt(searchParams.maxSumma, 10) : null,
      page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
    }),
    prisma.category.findMany({
      where: { businessId, isActive: true },
      orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
    }),
    // Faol kassalar — formada tanlash uchun (bitta bo'lsa qadam yashiriladi).
    listAccounts(businessId, true),
    // Qarzga mas'ul sotuvchi/operator tanlash uchun (bitta bo'lsa yashiriladi).
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, ism: true },
      orderBy: { ism: "asc" },
      take: 100,
    }),
  ]);

  // QARZ bo'limi jami — uchta manba qo'shiladi:
  //  1) `Debt` yozuvlari — yangi qarzlar shu yerga tushadi (asosiy manba);
  //  2) `totals.qarzKirim` — ESKI `tolovTuri="qarz"` tranzaksiyalari
  //     (scripts/qarz-migratsiya.ts ko'chirmaguncha);
  //  3) kunlik hisobotdagi qo'lda kiritilgan qarz tushumlari.
  // MUHIM: bu ko'rsatkich `totals.sof` ga KIRMAYDI — qarz real pul emas.
  const qarzWhereDebt: Prisma.DebtWhereInput = {
    businessId,
    turi: "olinadigan",
    status: { not: "CANCELLED" },
    // Eski tranzaksiyadan ko'chirilgan qarz ikki marta sanalmasin: uning
    // summasi `totals.qarzKirim` da allaqachon bor.
    manbaTransactionId: null,
  };
  {
    const scopeUserId = transactionScopeUserId(session);
    if (scopeUserId) qarzWhereDebt.userId = scopeUserId;
    if (searchParams.from || searchParams.to) {
      const sana: Prisma.DateTimeFilter = {};
      if (searchParams.from) sana.gte = dateOnlyStringToUTCDate(searchParams.from);
      if (searchParams.to) {
        sana.lt = new Date(dateOnlyStringToUTCDate(searchParams.to).getTime() + 24 * 60 * 60 * 1000);
      }
      qarzWhereDebt.sana = sana;
    }
  }
  const qarzYozuvlari =
    (await prisma.debt.aggregate({ _sum: { jamiSumma: true }, where: qarzWhereDebt }))._sum.jamiSumma ?? 0;

  let qarzSumma: number | null = null;
  if (await isModuleOnForTenant(tenantId, "KUNLIK")) {
    const qarzWhere: Prisma.DailyTransactionWhereInput = {
      businessId,
      tolovTuri: "DEBT",
      transactionId: null,
      deletedAt: null,
    };
    const scopeUserId = transactionScopeUserId(session);
    if (scopeUserId) qarzWhere.userId = scopeUserId;
    if (searchParams.from || searchParams.to) {
      const sana: Prisma.DateTimeFilter = {};
      if (searchParams.from) sana.gte = dateOnlyStringToUTCDate(searchParams.from);
      if (searchParams.to) {
        sana.lt = new Date(dateOnlyStringToUTCDate(searchParams.to).getTime() + 24 * 60 * 60 * 1000);
      }
      qarzWhere.report = { sana };
    }
    const agg = await prisma.dailyTransaction.aggregate({ _sum: { summa: true }, where: qarzWhere });
    qarzSumma = agg._sum.summa ?? 0;
  }

  // Ko'chirish maqsadlari — direktor uchun joriy bizneskan boshqa bizneslar.
  const canMove = isManager(session.rol);
  const moveTargets = canMove
    ? (await getAccessibleBusinesses(session))
        .filter((b) => b.id !== businessId)
        .map((b) => ({ id: b.id, nomi: b.nomi }))
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg">Tranzaksiyalar</h1>
      <TransactionsClient
        initialItems={result.items}
        initialTotal={result.total}
        page={result.page}
        pageSize={result.pageSize}
        categories={categories}
        accounts={accounts}
        masullar={masullar}
        currentUserId={session.userId}
        currentUserRol={session.rol}
        hideProfit={hideProfit}
        moveTargets={moveTargets}
        totals={result.totals}
        qarzSumma={
          qarzSumma === null && result.totals.qarzKirim === 0 && qarzYozuvlari === 0
            ? null
            : (qarzSumma ?? 0) + result.totals.qarzKirim + qarzYozuvlari
        }
        filters={{
          from: searchParams.from ?? "",
          to: searchParams.to ?? "",
          turi: searchParams.turi ?? "",
          categoryId: searchParams.categoryId ?? "",
          q: searchParams.q ?? "",
          minSumma: searchParams.minSumma ? formatSom(parseInt(searchParams.minSumma, 10)) : "",
          maxSumma: searchParams.maxSumma ? formatSom(parseInt(searchParams.maxSumma, 10)) : "",
        }}
      />
    </div>
  );
  });
}
