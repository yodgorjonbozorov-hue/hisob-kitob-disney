import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { redirect } from "next/navigation";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listOrders, listSuppliers, getXaridStats } from "@/lib/queries/xarid";
import { listProducts, type ProductAdminDTO } from "@/lib/queries/inventory";
import { monthRangeUTC, currentMonthString } from "@/lib/date";
import { XaridClient } from "./XaridClient";

/** XARID — ta'minotchidan tovar olish buyurtmalari va ularni qabul qilish. */
export default async function XaridPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "XARID");
    if (!isManager(session.rol)) redirect("/app");

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-fg">Xarid</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const { from, to } = monthRangeUTC(currentMonthString());
    const [orders, suppliers, products, stats] = await Promise.all([
      listOrders(businessId),
      listSuppliers(businessId, true),
      listProducts(businessId, { forKassir: false }) as Promise<ProductAdminDTO[]>,
      getXaridStats(businessId, from, to),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">Xarid</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> ·
            Buyurtma qabul qilinganda tovar omborga tushadi va chiqim/qarz avtomatik yoziladi
          </p>
        </div>
        <XaridClient
          orders={orders}
          suppliers={suppliers}
          products={products}
          stats={stats}
          omborli={business?.omborli ?? false}
        />
      </div>
    );
  });
}
