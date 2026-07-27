import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { logSuperadminAction } from "@/lib/superadmin/service";

/**
 * Impersonatsiyani tugatish: sessiya superadminga qaytariladi.
 * DIQQAT: bu route'da withSuperadmin ISHLATILMAYDI — joriy sessiya tenant
 * foydalanuvchisiniki; huquq `impersonatedBy` dagi user haqiqatan SUPERADMIN
 * ekanini bazadan tekshirish orqali beriladi.
 */
export async function POST() {
  const session = await getSession();
  if (!session.userId || !session.impersonatedBy) {
    return NextResponse.json({ error: "Impersonatsiya rejimi yo'q" }, { status: 400 });
  }

  const superadmin = await rawPrisma.user.findUnique({ where: { id: session.impersonatedBy } });
  if (!superadmin || !superadmin.isActive || superadmin.rol !== "SUPERADMIN") {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  await logSuperadminAction({
    superadminId: superadmin.id,
    superadminIsm: superadmin.ism,
    action: "impersonate_exit",
    entity: "tenant",
    entityId: session.tenantId ?? "-",
    detail: { targetUserId: session.userId },
  });

  session.userId = superadmin.id;
  session.login = superadmin.login;
  session.ism = superadmin.ism;
  session.rol = "SUPERADMIN";
  session.tenantId = null;
  session.businessId = null;
  session.mustChangePassword = false;
  session.impersonatedBy = null;
  await session.save();

  return NextResponse.json({ ok: true });
}
