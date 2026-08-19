import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { getTenantModullari, setTenantModul, logSuperadminAction } from "@/lib/superadmin/service";

/** Tenantning modul holati (superadmin paneli uchun). */
export const GET = withSuperadmin<{ params: { id: string } }>(async (_request, { params }) => {
  return NextResponse.json(await getTenantModullari(params.id));
});

const schema = z.object({ code: z.string().min(1), isActive: z.boolean() });

/**
 * Modulni superadmin nomidan yoqish/o'chirish.
 *
 * O'CHIRISH MA'LUMOTNI O'CHIRMAYDI — faqat kirishni yopadi (sotuvlar,
 * cheklar, mahsulotlar va tarix bazada qoladi). Amal audit jurnaliga
 * yoziladi: kim, qachon, qaysi kompaniyaning qaysi modulini o'zgartirgani
 * keyin ko'rinib turishi kerak.
 */
export const POST = withSuperadmin<{ params: { id: string } }>(async (request, { params }, session) => {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Xato ma'lumot" }, { status: 400 });
  }

  const natija = await setTenantModul({
    tenantId: params.id,
    code: parsed.data.code,
    isActive: parsed.data.isActive,
  });

  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: parsed.data.isActive ? "module_on" : "module_off",
    entity: "tenant",
    entityId: params.id,
    detail: { modul: parsed.data.code, isActive: parsed.data.isActive },
  });

  return NextResponse.json({ ok: true, ...natija });
});
