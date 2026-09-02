import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { requirePermission } from "@/lib/permissions/tekshir";
import { zakazBahosi, zakazBahosiniSaqlash } from "@/lib/services/zakazBaho";
import { zakazBahoSchema } from "@/lib/validation/xodimKategoriya";

/** Zakaz sifat nazorati: joriy baho (zakaz + xodimlar). */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    return NextResponse.json(await zakazBahosi(businessId, params.id));
  },
  { module: "CRM" }
);

/**
 * Bahoni yozish/yangilash — `crm.baho` huquqi (OWNER/ADMIN'da bor).
 * Faqat yakunlangan zakaz baholanadi (xizmat qatlami majburlaydi).
 */
export const PUT = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    await requirePermission(user.userId, "crm.baho");
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = zakazBahoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(
      await zakazBahosiniSaqlash({ businessId, dealId: params.id, userId: user.userId, data: parsed.data })
    );
  },
  { module: "CRM" }
);
