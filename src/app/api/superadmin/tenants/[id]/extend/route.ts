import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { extendTenant } from "@/lib/billing/subscribe";
import { logSuperadminAction } from "@/lib/superadmin/service";
import { z } from "zod";

const schema = z.object({ kunlar: z.number().int().min(1).max(366) });

/** Tenant muddatini to'lovsiz uzaytirish (bonus/qo'lda uzaytirish). */
export const POST = withSuperadmin<{ params: { id: string } }>(async (request, { params }, session) => {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Kunlar soni noto'g'ri (1-366)" }, { status: 400 });
  }

  const tenant = await extendTenant(params.id, parsed.data.kunlar);
  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: "extend",
    entity: "tenant",
    entityId: params.id,
    detail: { kunlar: parsed.data.kunlar, yangiMuddat: tenant.currentPeriodEnd },
  });

  return NextResponse.json({ ok: true, status: tenant.status, currentPeriodEnd: tenant.currentPeriodEnd });
});
