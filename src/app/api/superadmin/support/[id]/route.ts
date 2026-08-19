import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { tiketTafsiloti, tiketYangila } from "@/lib/superadmin/support";
import { tiketYangilashSchema } from "@/lib/validation/superadmin";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";

export const dynamic = "force-dynamic";

export const GET = withSuperadmin<{ params: { id: string } }>(
  r("support", "VIEW"),
  async (_request, { params }) => {
    const tiket = await tiketTafsiloti(params.id);
    if (!tiket) return NextResponse.json({ error: "Tiket topilmadi" }, { status: 404 });
    return NextResponse.json(tiket);
  }
);

export const PATCH = withSuperadmin<{ params: { id: string } }>(
  r("support", "MANAGE"),
  async (request, { params }, sa) => {
    const parsed = tiketYangilashSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const { oldingi, yangi } = await tiketYangila(params.id, {
      ...parsed.data,
      muallifId: sa.session.userId,
      muallifIsm: sa.session.ism,
    });

    await superadminAudit({
      sa,
      amal: SA_AMAL.SUPPORT_TICKET_UPDATED,
      entity: "ticket",
      entityId: params.id,
      tenantId: yangi.tenantId,
      before: { holat: oldingi.holat, muhimlik: oldingi.muhimlik, masulId: oldingi.masulId },
      after: { holat: yangi.holat, muhimlik: yangi.muhimlik, masulId: yangi.masulId },
    });

    return NextResponse.json({ ok: true, holat: yangi.holat });
  }
);
