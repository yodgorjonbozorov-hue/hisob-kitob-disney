import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/auth/roles";
import { isPro } from "@/lib/billing/pro";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listSuppliers } from "@/lib/queries/xarid";
import { TaminotchilarClient } from "./TaminotchilarClient";
import Link from "next/link";

/**
 * TA'MINOTCHILAR — kimdan tovar olamiz va ular bilan hisob-kitob.
 *
 * Ilgari bu sahifa XARID modulining yon panel punkti edi. Endi u OMBOR
 * ostida: "Tovar keldi" oqimi ta'minotchini talab qiladi, ya'ni reyestr
 * omborning bir qismi. Modul darvozasi ham shu sababdan OMBOR — rejali
 * xarid moduli yoqilmagan biznes ham ta'minotchisini yuritishi kerak.
 * Ma'lumot AYNI BIR jadvalda (`Supplier`), ikkinchi reyestr yaratilmadi.
 */
export default async function TaminotchilarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "OMBOR");
    if (!isManager(session.rol)) redirect("/app");

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Ta&apos;minotchilar</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const pro = isPro(ctx.tenant.plan);
    const [suppliers, userlar] = await Promise.all([
      listSuppliers(businessId),
      // Ta'minotchini tizim useriga bog'lash (PRO) uchun tanlov ro'yxati.
      pro
        ? prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, ism: true },
            orderBy: { ism: "asc" },
          })
        : Promise.resolve([]),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Ta&apos;minotchilar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> ·
            Har ta&apos;minotchi bo&apos;yicha jami xarid va ochiq buyurtmalar
          </p>
          <Link href="/app/ombor" className="text-sm text-brand hover:underline">
            &larr; Omborga qaytish
          </Link>
        </div>
        <TaminotchilarClient suppliers={suppliers} userlar={userlar} />
      </div>
    );
  });
}
