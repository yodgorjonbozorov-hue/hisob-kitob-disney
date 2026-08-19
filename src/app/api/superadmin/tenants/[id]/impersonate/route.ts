import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { getSession } from "@/lib/auth/session";
import { normalizeRol } from "@/lib/auth/roles";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { findImpersonationTarget } from "@/lib/superadmin/service";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { impersonateSchema } from "@/lib/validation/superadmin";

/**
 * Kompaniya nomidan kirish (impersonate).
 *
 * Qattiq shartlar (talab 26):
 *  · alohida ruxsat — `impersonatsiya.CREATE` (SUPPORT roliga ATAYLAB yopiq);
 *  · SABAB majburiy;
 *  · audit sessiya almashtirishdan OLDIN yoziladi (majburiy iz);
 *  · sessiyada `impersonatedBy` qoladi — ilova yuqorisida banner ko'rinadi;
 *  · nishon foydalanuvchining `sessionEpoch` i ko'chiriladi, ya'ni uning
 *    sessiyalari bekor qilinsa impersonatsiya ham darhol uziladi.
 */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("impersonatsiya", "CREATE"),
  async (request, { params }, sa) => {
    const parsed = impersonateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Sabab kiritilishi shart" },
        { status: 400 }
      );
    }

    const tenant = await rawPrisma.tenant.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    });
    if (!tenant) return NextResponse.json({ error: "Kompaniya topilmadi" }, { status: 404 });

    const target = await findImpersonationTarget(tenant.id);
    if (!target) {
      return NextResponse.json({ error: "Bu kompaniyada faol direktor yo'q" }, { status: 400 });
    }

    await superadminAudit({
      sa,
      amal: SA_AMAL.IMPERSONATION_START,
      entity: "tenant",
      entityId: tenant.id,
      tenantId: tenant.id,
      after: { tenantName: tenant.name, targetUserId: target.id, targetLogin: target.login },
      sabab: parsed.data.sabab,
    });

    const s = await getSession();
    s.userId = target.id;
    s.login = target.login;
    s.ism = target.ism;
    s.rol = normalizeRol(target.rol);
    s.tenantId = target.tenantId;
    s.businessId = target.businessId ?? null;
    s.mustChangePassword = false; // impersonatsiyada parol almashtirish so'ralmaydi
    s.sessionEpoch = target.sessionEpoch;
    s.impersonatedBy = sa.session.userId;
    await s.save();

    return NextResponse.json({ ok: true, tenantName: tenant.name });
  }
);
