import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { resolveActiveBusinessId } from "@/lib/business";
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
  const session = await requireUser();
  const businessId = await resolveActiveBusinessId(session);
  // Sotuvchi kirim ham, chiqim ham qo'shadi/ko'radi — faqat "Sof foyda" ko'rsatkichi yashirin.
  const hideProfit = session.rol === "sotuvchi";

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
}
