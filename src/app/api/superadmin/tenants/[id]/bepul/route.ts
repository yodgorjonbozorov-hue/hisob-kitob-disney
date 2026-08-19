import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { setTenantBepul } from "@/lib/billing/subscribe";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { bepulSchema } from "@/lib/validation/superadmin";

/** Mijozni doimiy bepulga o'tkazish / bekor qilish. Sabab MAJBURIY (pul qarori). */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("bizneslar", "UPDATE"),
  async (request, { params }, sa) => {
    const parsed = bepulSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const tenant = await setTenantBepul(params.id, parsed.data.bepul);

    await superadminAudit({
      sa,
      amal: SA_AMAL.BUSINESS_FREE_CHANGED,
      entity: "tenant",
      entityId: params.id,
      tenantId: params.id,
      before: { bepul: !parsed.data.bepul },
      after: { bepul: tenant.bepul, name: tenant.name },
      sabab: parsed.data.sabab,
    });

    return NextResponse.json({ ok: true, bepul: tenant.bepul });
  }
);
