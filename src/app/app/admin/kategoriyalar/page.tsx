import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { getActiveBusiness } from "@/lib/business";
import { kgSavdoKorinadi } from "@/lib/mijozXos";
import { CategoriesClient } from "./CategoriesClient";

export default async function KategoriyalarPage() {
  const { session, tenantId, tenant } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  if (!isManager(session.rol)) {
    redirect("/app");
  }

  const activeBusiness = await getActiveBusiness(session);
  if (!activeBusiness) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Kategoriyalar</h1>
        <p className="text-muted">Hali biznes yaratilmagan. Bizneslar bo'limidan qo'shing.</p>
      </div>
    );
  }

  const categories = await prisma.category.findMany({
    where: { businessId: activeBusiness.id },
    orderBy: [{ turi: "asc" }, { tartib: "asc" }, { nomi: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Kategoriyalar</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{activeBusiness.nomi}</span>
        </p>
      </div>
      {/* Kg savdosi bayrog'i — mijozga xos (Fortex Selos). Boshqa mijozlarda
          bu ustun/tugma umuman ko'rinmaydi. */}
      <CategoriesClient initialCategories={categories} kgSavdo={kgSavdoKorinadi(tenant)} />
    </div>
  );
  });
}
