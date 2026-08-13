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

  const [result, categories, accounts] = await Promise.all([
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
  ]);

  // QARZ bo'limi jami — yozuvlardagi qarz tranzaksiyalari (totals.qarzKirim)
  // USTIGA kunlik hisobotda qo'lda kiritilgan qarz tushumlari qo'shiladi
  // (KUNLIK moduli yoqiq bo'lsa). Yozuvlardan avto-ulangan tushumlar
  // (transactionId bor) sanalmaydi — ular totals.qarzKirim'da allaqachon bor.
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
        currentUserId={session.userId}
        currentUserRol={session.rol}
        hideProfit={hideProfit}
        moveTargets={moveTargets}
        totals={result.totals}
        qarzSumma={
          qarzSumma === null && result.totals.qarzKirim === 0
            ? null
            : (qarzSumma ?? 0) + result.totals.qarzKirim
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
