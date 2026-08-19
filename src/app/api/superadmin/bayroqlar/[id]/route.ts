import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { bayroqYangila } from "@/lib/superadmin/bayroqlar";
import { bayroqYangilashSchema } from "@/lib/validation/superadmin";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";

export const PATCH = withSuperadmin<{ params: { id: string } }>(
  r("tizim", "MANAGE"),
  async (request, { params }, sa) => {
    const parsed = bayroqYangilashSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const { oldingi, yangi } = await bayroqYangila(params.id, parsed.data);

    await superadminAudit({
      sa,
      amal: SA_AMAL.FEATURE_FLAG_CHANGED,
      entity: "flag",
      entityId: yangi.kalit,
      before: { yoqilgan: oldingi.yoqilgan, doira: oldingi.doira, tenantIdlar: oldingi.tenantIdlar },
      after: { yoqilgan: yangi.yoqilgan, doira: yangi.doira, tenantIdlar: yangi.tenantIdlar },
      sabab: parsed.data.sabab,
    });

    return NextResponse.json({ ok: true, yoqilgan: yangi.yoqilgan });
  }
);
