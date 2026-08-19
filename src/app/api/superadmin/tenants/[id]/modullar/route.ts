import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { tenantModulHolati, modulniOzgartir } from "@/lib/superadmin/modullar";
import { superadminAudit } from "@/lib/superadmin/audit";
import { modulSchema } from "@/lib/validation/superadmin";
import { modulEntityId } from "@/lib/superadmin/modullar";

/** Kompaniyaning modul holati. */
export const GET = withSuperadmin<{ params: { id: string } }>(
  r("modullar", "VIEW"),
  async (_request, { params }) => {
    const modullar = await tenantModulHolati(params.id);
    return NextResponse.json({ modullar });
  }
);

/**
 * Modulni yoqish / o'chirish.
 *
 * O'CHIRISHDA MA'LUMOT O'CHMAYDI — faqat kirish yopiladi. Shuning uchun
 * o'chirishda sabab so'raladi, lekin ma'lumot yo'qolishi haqida ogohlantirish
 * BERILMAYDI: bu noto'g'ri bo'lardi.
 */
export const POST = withSuperadmin<{ params: { id: string } }>(
  r("modullar", "MANAGE"),
  async (request, { params }, sa) => {
    const parsed = modulSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    if (!parsed.data.isActive && !parsed.data.sabab) {
      return NextResponse.json({ error: "Modulni o'chirish sababi kiritilsin" }, { status: 400 });
    }

    const natija = await modulniOzgartir(params.id, parsed.data.code, parsed.data.isActive);

    await superadminAudit({
      sa,
      amal: natija.amal,
      entity: "module",
      entityId: modulEntityId(params.id, natija.code),
      tenantId: params.id,
      before: { yoqilgan: natija.oldingi },
      after: { yoqilgan: natija.isActive, nomi: natija.nomi },
      sabab: parsed.data.sabab ?? null,
    });

    return NextResponse.json({ ok: true, code: natija.code, isActive: natija.isActive });
  }
);
