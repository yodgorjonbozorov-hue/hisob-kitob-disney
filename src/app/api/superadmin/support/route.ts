import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { tiketlarRoyxati, tiketYarat, supportXulosa } from "@/lib/superadmin/support";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { matn } from "@/lib/superadmin/sorovParam";
import { tiketSchema } from "@/lib/validation/superadmin";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";

export const dynamic = "force-dynamic";

export const GET = withSuperadmin(r("support", "VIEW"), async (request) => {
  const p = new URL(request.url).searchParams;
  const [royxat, xulosa] = await Promise.all([
    tiketlarRoyxati(
      {
        qidiruv: matn(p, "qidiruv"),
        holat: matn(p, "holat"),
        muhimlik: matn(p, "muhimlik"),
        tenantId: matn(p, "tenantId"),
        masulId: matn(p, "masulId"),
      },
      sahifaParametrlari(p)
    ),
    supportXulosa(),
  ]);
  return NextResponse.json({ ...royxat, xulosa });
});

export const POST = withSuperadmin(r("support", "MANAGE"), async (request, _ctx, sa) => {
  const parsed = tiketSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  const { tiket, tenantNomi } = await tiketYarat({
    ...parsed.data,
    yaratuvchiId: sa.session.userId,
    yaratuvchiIsm: sa.session.ism,
  });

  await superadminAudit({
    sa,
    amal: SA_AMAL.SUPPORT_TICKET_CREATED,
    entity: "ticket",
    entityId: tiket.id,
    tenantId: tiket.tenantId,
    after: { mavzu: tiket.mavzu, muhimlik: tiket.muhimlik, tenant: tenantNomi },
  });

  return NextResponse.json({ ok: true, id: tiket.id }, { status: 201 });
});
