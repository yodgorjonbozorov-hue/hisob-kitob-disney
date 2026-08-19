import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { superRolNormalize } from "@/lib/superadmin/rbac";

/**
 * Impersonatsiyani tugatish: sessiya superadminga qaytariladi.
 *
 * DIQQAT: bu route'da `withSuperadmin` ISHLATILMAYDI — joriy sessiya tenant
 * foydalanuvchisiniki. Huquq `impersonatedBy` dagi user haqiqatan faol
 * SUPERADMIN ekanini bazadan tekshirish orqali beriladi.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId || !session.impersonatedBy) {
    return NextResponse.json({ error: "Impersonatsiya rejimi yo'q" }, { status: 400 });
  }

  const superadmin = await rawPrisma.user.findUnique({ where: { id: session.impersonatedBy } });
  if (!superadmin || !superadmin.isActive || superadmin.rol !== "SUPERADMIN") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const xff = request.headers.get("x-forwarded-for");
  await superadminAudit({
    sa: {
      session: {
        userId: superadmin.id,
        login: superadmin.login,
        ism: superadmin.ism,
        rol: "SUPERADMIN",
        tenantId: null,
        businessId: null,
        mustChangePassword: false,
        impersonatedBy: null,
        sessionEpoch: superadmin.sessionEpoch,
      },
      superRol: superRolNormalize(superadmin.superadminRol),
      ip: xff ? xff.split(",")[0].trim() : request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    },
    amal: SA_AMAL.IMPERSONATION_END,
    entity: "tenant",
    entityId: session.tenantId ?? "-",
    tenantId: session.tenantId ?? null,
    before: { targetUserId: session.userId },
  });

  session.userId = superadmin.id;
  session.login = superadmin.login;
  session.ism = superadmin.ism;
  session.rol = "SUPERADMIN";
  session.tenantId = null;
  session.businessId = null;
  session.mustChangePassword = false;
  session.sessionEpoch = superadmin.sessionEpoch;
  session.impersonatedBy = null;
  await session.save();

  return NextResponse.json({ ok: true });
}
