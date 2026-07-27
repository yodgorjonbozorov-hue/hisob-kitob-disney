import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { getSession } from "@/lib/auth/session";
import { normalizeRol } from "@/lib/auth/roles";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { findImpersonationTarget, logSuperadminAction } from "@/lib/superadmin/service";

/**
 * Tenant nomidan kirish (impersonate): sessiya tenantning birinchi faol
 * direktori (OWNER) sifatida qayta yoziladi, `impersonatedBy`da superadmin
 * saqlanadi. MAJBURIY audit log: kim, qachon, qaysi tenantga kirdi.
 */
export const POST = withSuperadmin<{ params: { id: string } }>(async (_request, { params }, session) => {
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant topilmadi" }, { status: 404 });
  }

  const target = await findImpersonationTarget(tenant.id);
  if (!target) {
    return NextResponse.json({ error: "Bu tenantda faol direktor yo'q" }, { status: 400 });
  }

  // Audit — sessiya almashtirishdan OLDIN yoziladi (majburiy iz).
  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: "impersonate",
    entity: "tenant",
    entityId: tenant.id,
    detail: { tenantName: tenant.name, targetUserId: target.id, targetLogin: target.login },
  });

  const s = await getSession();
  s.userId = target.id;
  s.login = target.login;
  s.ism = target.ism;
  s.rol = normalizeRol(target.rol);
  s.tenantId = target.tenantId;
  s.businessId = target.businessId ?? null;
  s.mustChangePassword = false; // impersonatsiyada parol almashtirish so'ralmaydi
  s.impersonatedBy = session.userId;
  await s.save();

  return NextResponse.json({ ok: true, tenantName: tenant.name });
});
