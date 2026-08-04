import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId, getAccessibleBusinesses } from "@/lib/business";
import { isManager } from "@/lib/auth/roles";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { listTransactions } from "@/lib/queries/transactions";
import { formatSom } from "@/lib/format";
import { TransactionsClient } from "./TransactionsClient";

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

  const [result, categories] = await Promise.all([
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
  ]);

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
        currentUserId={session.userId}
        currentUserRol={session.rol}
        hideProfit={hideProfit}
        moveTargets={moveTargets}
        totals={result.totals}
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
