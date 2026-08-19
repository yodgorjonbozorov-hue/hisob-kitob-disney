import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { rejectPayment } from "@/lib/billing/subscribe";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { tolovRadSchema } from "@/lib/validation/superadmin";

/** To'lovni rad etish (pul kelib tushmagan bo'lsa). Sabab MAJBURIY. */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("billing", "UPDATE"),
  async (request, { params }, sa) => {
    const parsed = tolovRadSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Sabab kiritilishi shart" },
        { status: 400 }
      );
    }

    const payment = await rejectPayment(params.id, parsed.data.sabab);

    await superadminAudit({
      sa,
      amal: SA_AMAL.PAYMENT_REJECTED,
      entity: "payment",
      entityId: params.id,
      tenantId: payment.tenantId,
      after: { izoh: parsed.data.sabab },
      sabab: parsed.data.sabab,
    });

    return NextResponse.json({ ok: true });
  }
);
