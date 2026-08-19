import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { extendTenant } from "@/lib/billing/subscribe";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { extendSchema } from "@/lib/validation/superadmin";
import { rawPrisma } from "@/lib/db/rawPrisma";

/** Kompaniya muddatini to'lovsiz uzaytirish (bonus/qo'lda uzaytirish). */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("obunalar", "UPDATE"),
  async (request, { params }, sa) => {
    const parsed = extendSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Kunlar soni noto'g'ri (1-366)" },
        { status: 400 }
      );
    }

    const oldingi = await rawPrisma.tenant.findUnique({
      where: { id: params.id },
      select: { status: true, currentPeriodEnd: true },
    });
    const tenant = await extendTenant(params.id, parsed.data.kunlar);

    await superadminAudit({
      sa,
      amal: SA_AMAL.SUBSCRIPTION_EXTENDED,
      entity: "tenant",
      entityId: params.id,
      tenantId: params.id,
      before: oldingi ?? undefined,
      after: { kunlar: parsed.data.kunlar, status: tenant.status, muddat: tenant.currentPeriodEnd },
      sabab: parsed.data.sabab ?? null,
    });

    return NextResponse.json({
      ok: true,
      status: tenant.status,
      currentPeriodEnd: tenant.currentPeriodEnd,
    });
  }
);
