import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { blockTenant, unblockTenant, logSuperadminAction } from "@/lib/superadmin/service";
import { z } from "zod";

const schema = z.object({ blocked: z.boolean() });

/** Tenantni bloklash / blokdan chiqarish. */
export const POST = withSuperadmin<{ params: { id: string } }>(async (request, { params }, session) => {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Xato ma'lumot" }, { status: 400 });
  }

  const tenant = parsed.data.blocked ? await blockTenant(params.id) : await unblockTenant(params.id);
  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: parsed.data.blocked ? "block" : "unblock",
    entity: "tenant",
    entityId: params.id,
    detail: { yangiStatus: tenant.status },
  });

  return NextResponse.json({ ok: true, status: tenant.status });
});
