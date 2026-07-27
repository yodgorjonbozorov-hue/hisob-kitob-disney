import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { getActiveBusiness } from "@/lib/business";
import { listProducts, listRecentSales, type ProductKassirDTO } from "@/lib/queries/inventory";
import { SotuvClient } from "./SotuvClient";

export default async function SotuvPage() {
  const { session, tenantId } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  // Sotuvchi faqat kirim/chiqim kiritadi — bu sahifa unga yopiq.
  if (session.rol === "SELLER") {
    redirect("/app");
  }
  const business = await getActiveBusiness(session);
  if (!business || !business.omborli) {
    redirect("/app");
  }

  // Kassir uchun ham, admin uchun ham sotuv formasi bir xil (miqdorsiz — faqat mavjudlik).
  const [products, sales] = await Promise.all([
    listProducts(business.id, { forKassir: true }) as Promise<ProductKassirDTO[]>,
    listRecentSales(business.id, 15),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Sotuv</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{business.nomi}</span>
        </p>
      </div>
      <SotuvClient products={products} initialSales={sales} />
    </div>
  );
  });
}
