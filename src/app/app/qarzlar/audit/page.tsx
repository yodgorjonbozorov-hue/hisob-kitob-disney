import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isDirektor } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/permissions/tekshir";
import { resolveActiveBusinessId } from "@/lib/business";
import { listQarzAudit } from "@/lib/queries/qarzAudit";
import { QarzAuditRoyxat } from "./QarzAuditRoyxat";
import { QarzAuditFiltr } from "./QarzAuditFiltr";

/**
 * QARZ AUDIT TARIXI — FAQAT DIREKTOR (7-talab).
 *
 * "Kim, qaysi qarzni, qachon va nega o'zgartirdi" savoliga javob beradi.
 * Manba — mavjud `AuditLog` jadvali (lib/queries/qarzAudit.ts).
 *
 * O'CHIRILGAN QARZ HAM SHU YERDA QOLADI: jurnal qarzga FK bilan
 * bog'lanmagan, mijoz nomi va summa esa yozuv suratida saqlanadi.
 *
 * HUQUQ SERVERDA: `isDirektor` (faqat OWNER) + `qarz.tahrir`.
 * Administrator ham ko'ra olmaydi — tahrir huquqi bilan AYNI chegara.
 * Havolani yashirish himoya emas: URL qo'lda terilsa ham sahifa ochilmaydi.
 */
export default async function QarzAuditPage({
  searchParams,
}: {
  searchParams?: { amal?: string; q?: string; page?: string };
}) {
  const { session, tenantId } = await requireTenantPage();

  return runWithTenant(tenantId, async () => {
    // Audit tarixi ham qarz tahriri bilan AYNI qoidada: faqat direktor.
    if (!isDirektor(session.rol)) redirect("/app/qarzlar");
    if (!(await hasPermission(session.userId, "qarz.tahrir"))) redirect("/app/qarzlar");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Qarz audit tarixi</h1>
          <p className="text-muted">Sizga biznes biriktirilmagan.</p>
        </div>
      );
    }

    const amal =
      searchParams?.amal === "update" ||
      searchParams?.amal === "delete" ||
      searchParams?.amal === "create"
        ? searchParams.amal
        : null;

    const natija = await listQarzAudit({
      businessId,
      amal,
      q: searchParams?.q ?? null,
      page: searchParams?.page ? parseInt(searchParams.page, 10) : 1,
      pageSize: 40,
    });

    return (
      <div className="space-y-4">
        <div>
          <Link href="/app/qarzlar" className="text-2xs text-muted hover:text-brand">
            ← Qarzlar
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-fg mt-1">Qarz audit tarixi</h1>
          <p className="text-2xs sm:text-sm text-muted mt-0.5">
            Qarz yozuvlariga qilingan har bir o&apos;zgarish: kim, nima, qachon va nega.
            O&apos;chirilgan qarzning yozuvi ham shu yerda qoladi.
          </p>
        </div>

        <QarzAuditFiltr amal={amal ?? ""} q={searchParams?.q ?? ""} />
        <QarzAuditRoyxat items={natija.items} />

        {natija.total > natija.pageSize && (
          <p className="text-2xs text-faint px-1">
            Jami {natija.total} ta yozuv · {natija.page}-sahifa
          </p>
        )}
      </div>
    );
  });
}
