import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { getActiveBusiness } from "@/lib/business";
import { listDebts } from "@/lib/queries/inventory";
import { QarzlarClient } from "./QarzlarClient";

export default async function QarzlarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  // OMBOR moduli yoqilmagan bo'lsa — asosiy sahifaga.
  await requireModulePage(ctx, "OMBOR");
  // Sotuvchi faqat kirim/chiqim kiritadi — bu sahifa unga yopiq.
  if (session.rol === "SELLER") {
    redirect("/app");
  }
  const business = await getActiveBusiness(session);
  if (!business || !business.omborli) {
    redirect("/app");
  }

  const debts = await listDebts(business.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Qarzdorlik</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{business.nomi}</span>
        </p>
      </div>
      <QarzlarClient initialDebts={debts} />
    </div>
  );
  });
}
