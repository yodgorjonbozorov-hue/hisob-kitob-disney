import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { getActiveBusiness } from "@/lib/business";
import { isManager } from "@/lib/auth/roles";
import { listKodliMahsulotlar } from "@/lib/queries/pos";
import { QrClient } from "./QrClient";

export const metadata = { title: "QR / Shtrix-kod — Balansa" };

/**
 * QR / SHTRIX-KOD sahifasi — mahsulotga kod biriktirish, ko'rish va chop etish.
 *
 * Katalogni o'zgartirish amali, shu bois faqat boshqaruvchi (OWNER/ADMIN).
 */
export default async function QrPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    if (!isManager(session.rol)) {
      redirect("/app");
    }
    const [, business] = await Promise.all([
      requireModulePage(ctx, "MAGAZIN"),
      getActiveBusiness(session),
    ]);
    if (!business || !business.magazin || !business.omborli) {
      redirect("/app");
    }

    const mahsulotlar = await listKodliMahsulotlar(business.id);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">QR / Shtrix-kod</h1>
          <p className="text-sm text-muted mt-1">
            Quti ustidagi zavod kodini saqlang; kodi yo&apos;q tovarga Balansa QR yarating.
            Narx QR ichiga yozilmaydi — narx o&apos;zgarsa stikerni qayta bosish shart emas.
          </p>
        </div>
        <QrClient mahsulotlar={mahsulotlar} />
      </div>
    );
  });
}
