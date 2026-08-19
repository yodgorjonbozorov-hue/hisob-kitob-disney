import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { confirmPayment } from "@/lib/billing/subscribe";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { tolovQarorSchema } from "@/lib/validation/superadmin";

/** MANUAL to'lovni tasdiqlash — obuna 30 kunga uzayadi. */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("billing", "UPDATE"),
  async (request, { params }, sa) => {
    const parsed = tolovQarorSchema.safeParse(await request.json().catch(() => ({})));
    const sabab = parsed.success ? (parsed.data.sabab ?? null) : null;

    const { payment, tenant } = await confirmPayment(params.id);

    await superadminAudit({
      sa,
      amal: SA_AMAL.PAYMENT_CONFIRMED,
      entity: "payment",
      entityId: params.id,
      tenantId: tenant.id,
      after: {
        amount: payment.amount,
        tenantStatus: tenant.status,
        yangiMuddat: tenant.currentPeriodEnd,
      },
      sabab,
    });

    return NextResponse.json({
      ok: true,
      tenantStatus: tenant.status,
      currentPeriodEnd: tenant.currentPeriodEnd,
    });
  }
);
