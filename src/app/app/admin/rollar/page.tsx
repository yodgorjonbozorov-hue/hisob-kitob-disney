import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { isPro } from "@/lib/billing/pro";
import { RollarClient } from "./RollarClient";

export default async function RollarPage() {
  const { session, tenantId, tenant } = await requireTenantPage();
  return runWithTenant(tenantId, async () => {
    if (!isManager(session.rol)) {
      redirect("/app");
    }

    const pro = isPro(tenant.plan);
    const roles = pro
      ? await prisma.role.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            nomi: true,
            izoh: true,
            huquqlar: true,
            bazaRol: true,
            isActive: true,
            _count: { select: { users: { where: { isActive: true } } } },
          },
          orderBy: { createdAt: "asc" },
        })
      : [];

    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Rollar va huquqlar</h1>
        <RollarClient
          pro={pro}
          initialRoles={roles.map((r) => ({
            id: r.id,
            nomi: r.nomi,
            izoh: r.izoh,
            huquqlar: r.huquqlar,
            bazaRol: r.bazaRol,
            isActive: r.isActive,
            userSoni: r._count.users,
          }))}
        />
      </div>
    );
  });
}
