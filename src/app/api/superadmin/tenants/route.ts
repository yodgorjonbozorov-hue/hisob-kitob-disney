import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { createClientTenant } from "@/lib/superadmin/newClient";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { yangiMijozSchema } from "@/lib/validation/superadmin";

/** Yangi mijoz (kompaniya) yaratish. */
export const POST = withSuperadmin(r("bizneslar", "CREATE"), async (request, _ctx, sa) => {
  const parsed = yangiMijozSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const { tenant, user, business, plan, periodEnd } = await createClientTenant(parsed.data);

  await superadminAudit({
    sa,
    amal: SA_AMAL.BUSINESS_CREATED,
    entity: "tenant",
    entityId: tenant.id,
    tenantId: tenant.id,
    // Parol jurnalga YOZILMAYDI (audit tozalagichi ham uni yashiradi).
    after: {
      nom: tenant.name,
      login: user.login,
      tarif: plan.code,
      turi: business.turi,
      kunlar: parsed.data.kunlar,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      tenantId: tenant.id,
      nom: tenant.name,
      login: user.login,
      tarif: plan.code,
      turi: business.turi,
      muddat: periodEnd,
    },
    { status: 201 }
  );
});
