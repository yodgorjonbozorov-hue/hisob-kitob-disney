import { notFound } from "next/navigation";
import Link from "next/link";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { getMijozKartochka } from "@/lib/queries/mijoz";
import { KartochkaClient } from "./KartochkaClient";

/** Bitta mijozning butun tarixi — sotuv, qarz va bitimlar bitta sahifada. */
export default async function MijozKartochkaPage({ params }: { params: { id: string } }) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "MIJOZLAR");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) notFound();

    const kartochka = await getMijozKartochka(businessId, params.id);
    if (!kartochka) notFound();

    return (
      <div className="space-y-6">
        <div>
          <Link href="/app/mijozlar" className="text-2xs text-brand hover:underline">
            ← Mijozlar
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-fg mt-1">{kartochka.mijoz.ism}</h1>
          <p className="text-sm text-muted mt-1">
            {kartochka.mijoz.tel ?? "Telefon kiritilmagan"}
            {kartochka.mijoz.telegram && ` · ${kartochka.mijoz.telegram}`}
          </p>
        </div>
        <KartochkaClient kartochka={kartochka} boshqaruvchi={isManager(session.rol)} />
      </div>
    );
  });
}
