import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { requirePro } from "@/lib/billing/pro";
import { listRoles, createRole } from "@/lib/services/rollar";
import { createRoleSchema } from "@/lib/validation/rol";

/** Maxsus rollar ro'yxati — boshqaruvchilar uchun (PRO). */
export const GET = withTenant(async (_request, _ctx, tenant) => {
  requireManager(tenant.session.rol);
  requirePro(tenant);
  return NextResponse.json(await listRoles());
});

/** Yangi maxsus rol yaratish (PRO). */
export const POST = withTenant(async (request, _ctx, tenant) => {
  requireManager(tenant.session.rol);
  requirePro(tenant);

  const parsed = createRoleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }
  return NextResponse.json(await createRole(parsed.data), { status: 201 });
});
