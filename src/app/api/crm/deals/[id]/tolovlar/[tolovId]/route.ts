import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { zakazTolovniBekorQilish } from "@/lib/crm/tolovQoshish";
import { zakazTolovHisobi } from "@/lib/crm/tolovOqish";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * ZAKAZ TO'LOVINI BEKOR QILISH — xato kiritilgan to'lovni orqaga olish.
 *
 * To'lov KIRIM yozuvi bilan birga tug'ilgani uchun bu shunchaki o'chirish
 * emas: bog'langan kirim YUMSHOQ o'chiriladi va zakaz yig'indisi qayta
 * hisoblanadi — hammasi bitta tranzaksiyada (`lib/crm/tolovQoshish.ts`).
 */
export const DELETE = withTenant<{ params: { id: string; tolovId: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    await zakazTolovniBekorQilish({
      businessId,
      dealId: params.id,
      tolovId: params.tolovId,
      userId: user.userId,
    });

    dashboardYangilandi(businessId);
    return NextResponse.json(await zakazTolovHisobi(businessId, params.id));
  },
  { module: "CRM" }
);
