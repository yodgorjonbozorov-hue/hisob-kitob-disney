import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { blockTenant, unblockTenant } from "@/lib/superadmin/service";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { blockSchema } from "@/lib/validation/superadmin";
import { rawPrisma } from "@/lib/db/rawPrisma";

/** Kompaniyani bloklash / blokdan chiqarish. Sabab MAJBURIY. */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("bizneslar", "MANAGE"),
  async (request, { params }, sa) => {
    const parsed = blockSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const oldingi = await rawPrisma.tenant.findUnique({
      where: { id: params.id },
      select: { name: true, status: true },
    });
    if (!oldingi) return NextResponse.json({ error: "Kompaniya topilmadi" }, { status: 404 });

    const tenant = parsed.data.blocked ? await blockTenant(params.id) : await unblockTenant(params.id);

    await superadminAudit({
      sa,
      amal: parsed.data.blocked ? SA_AMAL.BUSINESS_SUSPENDED : SA_AMAL.BUSINESS_ACTIVATED,
      entity: "tenant",
      entityId: params.id,
      tenantId: params.id,
      before: { status: oldingi.status },
      after: { status: tenant.status, name: oldingi.name },
      sabab: parsed.data.sabab,
    });

    return NextResponse.json({ ok: true, status: tenant.status });
  }
);
