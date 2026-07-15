import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { listTransactions } from "@/lib/queries/transactions";
import { TransactionsClient } from "./TransactionsClient";

interface SearchParams {
  from?: string;
  to?: string;
  turi?: string;
  categoryId?: string;
  q?: string;
  page?: string;
}

export default async function TranzaksiyalarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireUser();

  const [result, categories] = await Promise.all([
    listTransactions({
      from: searchParams.from,
      to: searchParams.to,
      turi: searchParams.turi,
      categoryId: searchParams.categoryId,
      q: searchParams.q,
      page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: [{ tartib: "asc" }, { nomi: "asc" }] }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Tranzaksiyalar</h1>
      <TransactionsClient
        initialItems={result.items}
        initialTotal={result.total}
        page={result.page}
        pageSize={result.pageSize}
        categories={categories}
        currentUserId={session.userId}
        currentUserRol={session.rol}
        filters={{
          from: searchParams.from ?? "",
          to: searchParams.to ?? "",
          turi: searchParams.turi ?? "",
          categoryId: searchParams.categoryId ?? "",
          q: searchParams.q ?? "",
        }}
      />
    </div>
  );
}
