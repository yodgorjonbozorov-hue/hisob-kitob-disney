import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { logSuperadminAction } from "@/lib/superadmin/service";
import { planByCode } from "@/lib/billing/plans";
import { z } from "zod";

const schema = z.object({ plan: z.string().min(1) });

/** Tenant tarifini qo'lda almashtirish (masalan PRO'ga ko'tarish). */
export const POST = withSuperadmin<{ params: { id: string } }>(async (request, { params }, session) => {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || !planByCode(parsed.data.plan)) {
    return NextResponse.json({ error: "Noma'lum tarif" }, { status: 400 });
  }

  const tenant = await rawPrisma.tenant.update({
    where: { id: params.id },
    data: { plan: parsed.data.plan },
  });

  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: "plan_change",
    entity: "tenant",
    entityId: params.id,
    detail: { yangiTarif: parsed.data.plan },
  });

  return NextResponse.json({ ok: true, plan: tenant.plan });
});
