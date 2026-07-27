import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { getActiveBusiness } from "@/lib/business";
import { listProducts, getOmborStats, getProductProfitability, type ProductAdminDTO } from "@/lib/queries/inventory";
import { OmborClient } from "./OmborClient";
import { Card } from "@/components/ui/Card";
import { formatSomLabel } from "@/lib/format";

export default async function OmborPage() {
  const { session, tenantId } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  if (!isManager(session.rol)) {
    redirect("/app");
  }
  const business = await getActiveBusiness(session);
  if (!business || !business.omborli) {
    redirect("/app");
  }

  const [products, stats, profit] = await Promise.all([
    listProducts(business.id, { forKassir: false }) as Promise<ProductAdminDTO[]>,
    getOmborStats(business.id),
    getProductProfitability(business.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Ombor</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{business.nomi}</span>
        </p>
      </div>
      <OmborClient initialProducts={products} stats={stats} />

      {profit.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <h2 className="font-semibold text-fg px-5 pt-5 pb-3">Mahsulot foydaliligi</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-2">Mahsulot</th>
                  <th className="text-right px-3 py-2">Sotilgan</th>
                  <th className="text-right px-3 py-2">Daromad</th>
                  <th className="text-right px-3 py-2">Foyda</th>
                  <th className="text-right px-5 py-2">Marja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {profit.map((p) => (
                  <tr key={p.productId}>
                    <td className="px-5 py-2.5 font-medium">
                      {p.nomi}
                      {p.foyda < 0 && <span className="ml-2 text-2xs text-expense">zararga</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tnum">{p.sotilgan}</td>
                    <td className="px-3 py-2.5 text-right tnum">{formatSomLabel(p.daromad)}</td>
                    <td className={`px-3 py-2.5 text-right tnum font-medium ${p.foyda >= 0 ? "text-income" : "text-expense"}`}>
                      {formatSomLabel(p.foyda)}
                    </td>
                    <td className={`px-5 py-2.5 text-right tnum ${p.marja >= 0 ? "text-muted" : "text-expense"}`}>{p.marja}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
  });
}
