import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { prisma } from "@/lib/prisma";
import { listJadvallar } from "@/lib/services/davomatJadval";
import { JadvalClient, type JadvalDTO } from "./JadvalClient";

/** ISH JADVALI — Direktor/Admin tuzadi, xodim faqat ko'radi. */
export default async function JadvalPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");
    if (!isManager(session.rol)) redirect("/app");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Ish jadvali</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const [jadvallar, xodimlar] = await Promise.all([
      listJadvallar(businessId),
      prisma.employee.findMany({
        where: { businessId, deletedAt: null, isActive: true },
        select: { id: true, ism: true, workScheduleId: true },
        orderBy: { ism: "asc" },
      }),
    ]);

    const dto: JadvalDTO[] = jadvallar.map((j) => ({
      id: j.id,
      nomi: j.nomi,
      imtiyozDaqiqa: j.imtiyozDaqiqa,
      standart: j.standart,
      isActive: j.isActive,
      kunlar: j.kunlar.map((k) => ({
        hafta: k.hafta,
        ishKuni: k.ishKuni,
        boshlanish: k.boshlanish,
        tugash: k.tugash,
      })),
      xodimlar: xodimlar.filter((x) => x.workScheduleId === j.id).map((x) => x.ism),
    }));
    const jadvalsiz = xodimlar.filter((x) => !x.workScheduleId).length;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Ish jadvali</h1>
          <p className="text-sm text-muted mt-1">
            Kelish-ketish vaqtlari va imtiyoz (grace) shu yerda belgilanadi. Jadval biriktirilmagan
            xodimga standart jadval qo&apos;llanadi.
          </p>
        </div>
        <JadvalClient jadvallar={dto} jadvalsizXodim={jadvalsiz} />
      </div>
    );
  });
}
