import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listDeletedTransactions } from "@/lib/queries/transactions";
import { OchirilganlarClient } from "./OchirilganlarClient";

export default async function OchirilganlarPage() {
  const session = await requireUser();
  if (!isManager(session.rol)) {
    redirect("/tranzaksiyalar");
  }
  const businessId = await resolveActiveBusinessId(session);
  const business = await getActiveBusiness(session);

  const deleted = businessId ? await listDeletedTransactions(businessId) : [];
  const items = deleted.map((t) => ({
    id: t.id,
    turi: t.turi,
    summa: t.summa,
    categoryNomi: t.category.nomi,
    userIsm: t.user.ism,
    sana: t.sana.toISOString(),
    deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">O'chirilganlar</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · O'chirilgan yozuvlarni
          tiklash yoki butunlay o'chirish
        </p>
      </div>
      <OchirilganlarClient initialItems={items} />
    </div>
  );
}
