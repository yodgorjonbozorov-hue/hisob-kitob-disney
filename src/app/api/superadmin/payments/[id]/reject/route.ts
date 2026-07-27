import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { rejectPayment } from "@/lib/billing/subscribe";
import { logSuperadminAction } from "@/lib/superadmin/service";

/** To'lovni rad etish (pul kelib tushmagan bo'lsa). */
export const POST = withSuperadmin<{ params: { id: string } }>(async (request, { params }, session) => {
  const body = await request.json().catch(() => ({}));
  const izoh = typeof body?.izoh === "string" ? body.izoh : undefined;

  const payment = await rejectPayment(params.id, izoh);
  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: "payment_reject",
    entity: "payment",
    entityId: params.id,
    detail: { tenantId: payment.tenantId, izoh },
  });
  return NextResponse.json({ ok: true });
});
