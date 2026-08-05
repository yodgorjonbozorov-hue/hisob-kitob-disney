import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { prisma } from "@/lib/prisma";
import { listShartnomalar, getHujjatStats } from "@/lib/queries/hujjat";
import { saqlagichBor } from "@/lib/storage/driver";
import { HujjatlarClient } from "./HujjatlarClient";

/** HUJJATLAR — shartnomalar reyestri va ularga biriktirilgan fayllar. */
export default async function HujjatlarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HUJJATLAR");

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-fg">Shartnomalar</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const [shartnomalar, stats, mijozlar, taminotchilar] = await Promise.all([
      listShartnomalar(businessId),
      getHujjatStats(businessId),
      prisma.contact.findMany({
        where: { businessId, deletedAt: null },
        select: { id: true, ism: true },
        orderBy: { ism: "asc" },
      }),
      prisma.supplier.findMany({
        where: { businessId, deletedAt: null, isActive: true },
        select: { id: true, nomi: true },
        orderBy: { nomi: "asc" },
      }),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">Shartnomalar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> ·
            Muddati yaqinlashganda bildirishnomalar ro&apos;yxatida ogohlantirish chiqadi
          </p>
        </div>
        <HujjatlarClient
          shartnomalar={shartnomalar}
          stats={stats}
          mijozlar={mijozlar}
          taminotchilar={taminotchilar}
          boshqaruvchi={isManager(session.rol)}
          yuklashMumkin={saqlagichBor()}
        />
      </div>
    );
  });
}
