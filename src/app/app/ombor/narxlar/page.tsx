import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { isManager } from "@/lib/auth/roles";
import { getActiveBusiness } from "@/lib/business";
import { listProducts, type ProductAdminDTO } from "@/lib/queries/inventory";
import { NarxlarClient } from "./NarxlarClient";

export const metadata = { title: "Narx va qoldiq — Balansa" };

/**
 * NARX VA QOLDIQNI TO'LDIRISH.
 *
 * Boshqa dasturdan ko'chirilgan katalog narxsiz keladi. Har tovar uchun
 * modal ochish (200 marta) real ish emas — shu sahifa hammasini bitta
 * jadvalda ko'rsatadi va bir marta saqlaydi.
 */
export default async function NarxlarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "OMBOR");
    // Narx — boshqaruvchi ma'lumoti; kassir/sotuvchiga yopiq.
    if (!isManager(session.rol)) {
      redirect("/app");
    }
    const business = await getActiveBusiness(session);
    if (!business || !business.omborli) {
      redirect("/app");
    }

    const products = (await listProducts(business.id, { forKassir: false })) as ProductAdminDTO[];

    return <NarxlarClient products={products} biznesNomi={business.nomi} />;
  });
}
