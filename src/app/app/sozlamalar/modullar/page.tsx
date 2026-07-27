import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { prisma } from "@/lib/prisma";
import { korinadiganModullar } from "@/lib/modules/registry";
import { planByCode } from "@/lib/billing/plans";
import { ModullarClient } from "./ModullarClient";

/** Sozlamalar → Modullar: tenant o'z modullarini yoqadi/o'chiradi (faqat OWNER). */
export default async function ModullarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId, tenant } = ctx;
  return runWithTenant(tenantId, async () => {
    if (session.rol !== "OWNER") {
      redirect("/app");
    }

    const rows = await prisma.tenantModule.findMany({ select: { code: true, isActive: true } });
    const holatlar = new Map(rows.map((r) => [r.code, r.isActive]));
    const plan = planByCode(tenant.plan);

    const kartalar = korinadiganModullar().map((m) => ({
      code: m.code,
      nomi: m.nomi,
      tavsif: m.tavsif,
      core: m.core,
      tarifdaBor: m.core || (plan?.modullar.includes(m.code) ?? false),
      yoqilgan: m.core || (holatlar.get(m.code) ?? false),
    }));

    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-fg">Modullar</h1>
          <p className="text-sm text-muted mt-1">
            Biznesingizga kerakli bo'limlarni yoqing. O'chirilgan modul ma'lumotlari o'chmaydi —
            qayta yoqsangiz hammasi joyida bo'ladi.
          </p>
        </div>
        <ModullarClient kartalar={kartalar} />
      </div>
    );
  });
}
