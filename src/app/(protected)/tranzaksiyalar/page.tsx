import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { resolveActiveBusinessId } from "@/lib/business";
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
  const businessId = await resolveActiveBusinessId(session);
  // Sotuvchi faqat kirim (sotuv) yozuvlarini ko'radi va qo'shadi — chiqim/foyda yo'q.
  const kirimOnly = session.rol === "sotuvchi";

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
      turi: kirimOnly ? "kirim" : searchParams.turi,
      categoryId: searchParams.categoryId,
      q: searchParams.q,
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
        kirimOnly={kirimOnly}
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
