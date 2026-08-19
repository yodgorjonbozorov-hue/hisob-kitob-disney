import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { redirect } from "next/navigation";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { prisma } from "@/lib/prisma";
import { listRules } from "@/lib/queries/approval";
import { QoidalarClient } from "./QoidalarClient";

/** Tasdiq qoidalari — qaysi chiqim rahbar tasdig'isiz o'tmasligi shu yerda belgilanadi. */
export default async function QoidalarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "TASDIQLASH");
    if (!isManager(session.rol)) redirect("/app/tasdiqlash");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Tasdiq qoidalari</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const [qoidalar, kategoriyalar] = await Promise.all([
      listRules(businessId),
      prisma.category.findMany({
        where: { businessId, turi: "chiqim", isActive: true },
        select: { id: true, nomi: true },
        orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
      }),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Tasdiq qoidalari</h1>
          <p className="text-sm text-muted mt-1">
            Chegaradan KATTA chiqim tasdiq talab qiladi. Kategoriyasiz qoida barcha chiqimlarga
            tegishli; bir nechta qoida mos kelsa eng qattig&apos;i ishlaydi.
          </p>
        </div>
        <QoidalarClient qoidalar={qoidalar} kategoriyalar={kategoriyalar} />
      </div>
    );
  });
}
