import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { getActiveBusiness } from "@/lib/business";
import { isManager } from "@/lib/auth/roles";
import { listPosCheklar } from "@/lib/queries/pos";
import { CheklarClient } from "./CheklarClient";

export const metadata = { title: "Cheklar — Balansa" };

/** Kassa tarixi: cheklar va ularni qaytarish (bekor qilish). */
export default async function CheklarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    if (session.rol === "SELLER") {
      redirect("/app");
    }
    const [, business] = await Promise.all([
      requireModulePage(ctx, "MAGAZIN"),
      getActiveBusiness(session),
    ]);
    if (!business || !business.magazin || !business.omborli) {
      redirect("/app");
    }

    const cheklar = await listPosCheklar(business.id);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">Cheklar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business.nomi}</span>
          </p>
        </div>
        {/* Qaytarish — kassadan pul chiqaradi, shu bois faqat boshqaruvchida. */}
        <CheklarClient cheklar={cheklar} qaytaraOladi={isManager(session.rol)} />
      </div>
    );
  });
}
