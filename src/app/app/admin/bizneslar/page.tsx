import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { BusinessesClient } from "./BusinessesClient";

export default async function BizneslarPage() {
  const { session, tenantId } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  if (!isManager(session.rol)) {
    redirect("/app");
  }

  const businesses = await prisma.business.findMany({
    orderBy: { nomi: "asc" },
    select: {
      id: true,
      nomi: true,
      isActive: true,
      turi: true,
      _count: { select: { categories: true, transactions: true } },
    },
  });

  const dto = businesses.map((b) => ({
    id: b.id,
    nomi: b.nomi,
    isActive: b.isActive,
    turi: b.turi,
    kategoriyalar: b._count.categories,
    tranzaksiyalar: b._count.transactions,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg">Bizneslar</h1>
      <BusinessesClient initialBusinesses={dto} />
    </div>
  );
  });
}
