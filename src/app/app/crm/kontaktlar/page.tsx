import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { prisma } from "@/lib/prisma";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { KontaktlarClient } from "./KontaktlarClient";

/** CRM kontaktlar ro'yxati. */
export default async function KontaktlarPage() {
  const ctx = await requireTenantPage();
  const { tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "CRM");
    const businessId = await resolveActiveBusinessId(ctx.session);
    const business = await getActiveBusiness(ctx.session);

    const contacts = businessId
      ? await prisma.contact.findMany({
          where: { businessId, deletedAt: null },
          include: { _count: { select: { deals: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : [];

    return (
      <div className="space-y-4 max-w-3xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Kontaktlar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · {contacts.length} ta kontakt
          </p>
        </div>
        <KontaktlarClient
          initial={contacts.map((c) => ({
            id: c.id,
            ism: c.ism,
            tel: c.tel,
            telegram: c.telegram,
            izoh: c.izoh,
            bitimlar: c._count.deals,
          }))}
        />
      </div>
    );
  });
}
