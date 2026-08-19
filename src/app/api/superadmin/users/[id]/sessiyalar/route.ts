import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { sessiyalarniBekorQil } from "@/lib/superadmin/sessiyalar";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { sessiyaBekorSchema } from "@/lib/validation/superadmin";
import { rawPrisma } from "@/lib/db/rawPrisma";

/**
 * Foydalanuvchining BARCHA sessiyalarini bekor qilish (talab 25).
 *
 * Cheklov ochiq aytiladi: alohida qurilmani tanlab chiqarish mumkin emas —
 * iron-session stateless, server sessiya ro'yxatini saqlamaydi. Bekor qilish
 * har doim "hamma qurilmada".
 */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("foydalanuvchilar", "UPDATE"),
  async (request, { params }, sa) => {
    const parsed = sessiyaBekorSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Sabab kiritilishi shart" },
        { status: 400 }
      );
    }

    const user = await rawPrisma.user.findUnique({
      where: { id: params.id },
      select: { tenantId: true },
    });
    if (!user) return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });

    const natija = await sessiyalarniBekorQil(params.id);

    await superadminAudit({
      sa,
      amal: SA_AMAL.SESSION_REVOKED,
      entity: "user",
      entityId: params.id,
      tenantId: user.tenantId,
      after: { login: natija.login, yangiEpoch: natija.yangiEpoch },
      sabab: parsed.data.sabab,
    });

    return NextResponse.json({ ok: true, login: natija.login });
  }
);
