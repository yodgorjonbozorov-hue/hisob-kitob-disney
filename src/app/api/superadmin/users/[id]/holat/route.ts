import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { userHolatSchema } from "@/lib/validation/superadmin";

/**
 * Foydalanuvchini bloklash / faollashtirish.
 *
 * Bloklashda sessiya avlodi ham oshiriladi: hisob YOPILGANDA uning ochiq
 * cookie'lari ham DARHOL kuchsizlanadi (aks holda 7 kun ishlayverardi).
 *
 * O'ZINI bloklash TAQIQLANADI — superadmin o'zini panelidan qulflab qo'ymasin.
 */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("foydalanuvchilar", "MANAGE"),
  async (request, { params }, sa) => {
    const parsed = userHolatSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    if (params.id === sa.session.userId && !parsed.data.isActive) {
      return NextResponse.json({ error: "O'zingizni bloklay olmaysiz" }, { status: 400 });
    }

    const oldingi = await rawPrisma.user.findUnique({
      where: { id: params.id },
      select: { isActive: true, login: true, ism: true, tenantId: true, rol: true },
    });
    if (!oldingi) return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });

    await rawPrisma.user.update({
      where: { id: params.id },
      data: parsed.data.isActive
        ? { isActive: true }
        : { isActive: false, sessionEpoch: { increment: 1 } },
    });

    await superadminAudit({
      sa,
      amal: parsed.data.isActive ? SA_AMAL.USER_ACTIVATED : SA_AMAL.USER_SUSPENDED,
      entity: "user",
      entityId: params.id,
      tenantId: oldingi.tenantId,
      before: { isActive: oldingi.isActive },
      after: { isActive: parsed.data.isActive, login: oldingi.login, rol: oldingi.rol },
      sabab: parsed.data.sabab,
    });

    return NextResponse.json({ ok: true, isActive: parsed.data.isActive });
  }
);
