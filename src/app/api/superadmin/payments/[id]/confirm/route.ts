import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { confirmPayment } from "@/lib/billing/subscribe";
import { logSuperadminAction } from "@/lib/superadmin/service";

/** MANUAL to'lovni tasdiqlash — obuna 30 kunga uzayadi. */
export const POST = withSuperadmin<{ params: { id: string } }>(async (_request, { params }, session) => {
  const { payment, tenant } = await confirmPayment(params.id);
  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: "payment_confirm",
    entity: "payment",
    entityId: params.id,
    detail: { tenantId: tenant.id, amount: payment.amount, yangiMuddat: tenant.currentPeriodEnd },
  });
  return NextResponse.json({ ok: true, tenantStatus: tenant.status, currentPeriodEnd: tenant.currentPeriodEnd });
});
