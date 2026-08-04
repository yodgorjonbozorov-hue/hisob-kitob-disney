import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { setTenantBepul } from "@/lib/billing/subscribe";
import { logSuperadminAction } from "@/lib/superadmin/service";

const schema = z.object({ bepul: z.boolean() });

/** Mijozni doimiy bepulga o'tkazish / bekor qilish. */
export const POST = withSuperadmin<{ params: { id: string } }>(async (request, { params }, session) => {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Xato ma'lumot" }, { status: 400 });
  }

  const tenant = await setTenantBepul(params.id, parsed.data.bepul);
  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: parsed.data.bepul ? "bepul_yoqildi" : "bepul_bekor",
    entity: "tenant",
    entityId: params.id,
    detail: { name: tenant.name, bepul: tenant.bepul },
  });

  return NextResponse.json({ ok: true, bepul: tenant.bepul });
});
