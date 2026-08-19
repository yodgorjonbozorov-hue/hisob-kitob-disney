import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { planByCode } from "@/lib/billing/plans";
import { planSchema } from "@/lib/validation/superadmin";
import { tenantModulHolati } from "@/lib/superadmin/modullar";

/**
 * Kompaniya tarifini qo'lda almashtirish.
 *
 * MA'LUMOT O'CHIRILMAYDI: tarif pasaytirilsa, yangi tarifda yo'q modullar
 * shunchaki YOPILADI (`TenantModule` yozuvi joyida qoladi) — tarif qaytarilsa
 * modul va uning butun ma'lumoti aynan qaytadi. Javobda qaysi modullar
 * yopilishi ochiq qaytariladi, panel esa buni tasdiqdan OLDIN ko'rsatadi.
 */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("obunalar", "UPDATE"),
  async (request, { params }, sa) => {
    const parsed = planSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    const yangiPlan = planByCode(parsed.data.plan);
    if (!yangiPlan) return NextResponse.json({ error: "Noma'lum tarif" }, { status: 400 });

    const oldingi = await rawPrisma.tenant.findUnique({
      where: { id: params.id },
      select: { plan: true, name: true },
    });
    if (!oldingi) return NextResponse.json({ error: "Kompaniya topilmadi" }, { status: 404 });

    const oldingiModullar = await tenantModulHolati(params.id);
    const yopiladi = oldingiModullar
      .filter((m) => m.yoqilgan && !m.core && !yangiPlan.modullar.includes(m.code))
      .map((m) => m.nomi);

    const tenant = await rawPrisma.tenant.update({
      where: { id: params.id },
      data: { plan: parsed.data.plan },
    });

    await superadminAudit({
      sa,
      amal: SA_AMAL.PLAN_CHANGED,
      entity: "tenant",
      entityId: params.id,
      tenantId: params.id,
      before: { plan: oldingi.plan },
      after: { plan: tenant.plan, yopilganModullar: yopiladi },
      sabab: parsed.data.sabab,
    });

    return NextResponse.json({ ok: true, plan: tenant.plan, yopilganModullar: yopiladi });
  }
);
