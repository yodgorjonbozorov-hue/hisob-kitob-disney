import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { BusinessesClient } from "./BusinessesClient";

export default async function BizneslarPage() {
  const session = await requireUser();
  if (session.rol !== "admin") {
    redirect("/");
  }

  const businesses = await prisma.business.findMany({
    orderBy: { nomi: "asc" },
    select: {
      id: true,
      nomi: true,
      isActive: true,
      _count: { select: { categories: true, transactions: true } },
    },
  });

  const dto = businesses.map((b) => ({
    id: b.id,
    nomi: b.nomi,
    isActive: b.isActive,
    kategoriyalar: b._count.categories,
    tranzaksiyalar: b._count.transactions,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg">Bizneslar</h1>
      <BusinessesClient initialBusinesses={dto} />
    </div>
  );
}
