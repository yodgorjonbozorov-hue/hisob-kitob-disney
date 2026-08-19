import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { blockTenant, unblockTenant } from "@/lib/superadmin/service";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";
import { ommaviySchema } from "@/lib/validation/superadmin";

/**
 * OMMAVIY (bulk) AMALLAR (talab 35) — kompaniyalarni guruh bilan bloklash /
 * blokdan chiqarish.
 *
 * HAR YOZUV UCHUN ALOHIDA AUDIT yoziladi: "50 ta bloklandi" degan bitta
 * yozuv keyinchalik "qaysi kompaniya nega bloklangan?" savoliga javob
 * bermasdi. Bitta yozuv yiqilsa qolganlari davom etadi va natijada
 * muvaffaqiyatli/xato ro'yxati qaytariladi.
 */
export const POST = withSuperadmin(r("bizneslar", "MANAGE"), async (request, _ctx, sa) => {
  const parsed = ommaviySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }
  const { idlar, amal, sabab } = parsed.data;

  const bajarildi: string[] = [];
  const xatolar: { id: string; xato: string }[] = [];

  for (const id of idlar) {
    try {
      const tenant = amal === "block" ? await blockTenant(id) : await unblockTenant(id);
      await superadminAudit({
        sa,
        amal: amal === "block" ? SA_AMAL.BUSINESS_SUSPENDED : SA_AMAL.BUSINESS_ACTIVATED,
        entity: "tenant",
        entityId: id,
        tenantId: id,
        after: { status: tenant.status, ommaviy: true },
        sabab,
      });
      bajarildi.push(id);
    } catch (error) {
      xatolar.push({ id, xato: error instanceof Error ? error.message : "Noma'lum xato" });
    }
  }

  return NextResponse.json({ ok: true, bajarildi: bajarildi.length, xatolar });
});
