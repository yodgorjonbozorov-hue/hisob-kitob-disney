import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { deleteEmptyTenant } from "@/lib/superadmin/service";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { sababSchema } from "@/lib/validation/superadmin";

/**
 * Bo'sh (xatoga ochilgan takror) kompaniyani o'chirish — faqat ROOT.
 * Ish ma'lumoti yoki tasdiqlangan to'lovi bo'lsa servis rad etadi.
 * SABAB majburiy: bu qaytarib bo'lmaydigan amal.
 */
export const DELETE = withSuperadmin<{ params: { id: string } }>(
  r("bizneslar", "DELETE"),
  async (request, { params }, sa) => {
    const body: unknown = await request.json().catch(() => ({}));
    const sabab = sababSchema.safeParse((body as { sabab?: unknown })?.sabab);
    if (!sabab.success) {
      return NextResponse.json(
        { error: sabab.error.errors[0]?.message ?? "Sabab kiritilishi shart" },
        { status: 400 }
      );
    }

    const { name } = await deleteEmptyTenant(params.id);

    await superadminAudit({
      sa,
      amal: SA_AMAL.BUSINESS_DELETED,
      entity: "tenant",
      entityId: params.id,
      tenantId: params.id,
      before: { name },
      sabab: sabab.data,
    });

    return NextResponse.json({ ok: true, name });
  }
);
