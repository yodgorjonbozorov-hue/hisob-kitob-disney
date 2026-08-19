import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { bayroqlarRoyxati, bayroqYarat } from "@/lib/superadmin/bayroqlar";
import { bayroqSchema } from "@/lib/validation/superadmin";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";

export const dynamic = "force-dynamic";

export const GET = withSuperadmin(r("tizim", "VIEW"), async () =>
  NextResponse.json({ bayroqlar: await bayroqlarRoyxati() })
);

/** Yangi feature flag — faqat tizim boshqaruvi huquqi bor rol (ROOT). */
export const POST = withSuperadmin(r("tizim", "MANAGE"), async (request, _ctx, sa) => {
  const parsed = bayroqSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  const bayroq = await bayroqYarat(parsed.data);

  await superadminAudit({
    sa,
    amal: SA_AMAL.FEATURE_FLAG_CHANGED,
    entity: "flag",
    entityId: bayroq.kalit,
    after: { yaratildi: true, yoqilgan: bayroq.yoqilgan, doira: bayroq.doira },
    sabab: parsed.data.sabab,
  });

  return NextResponse.json({ ok: true, id: bayroq.id }, { status: 201 });
});
