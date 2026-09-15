import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { zakazTolovHisobi, zakazTolovniOchirish } from "@/lib/crm/tolovQoshish";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * XATO YOZILGAN TO'LOVNI OLIB TASHLASH — FAQAT DIREKTOR/ADMINISTRATOR.
 *
 * HUQUQ SERVERDA (`requireManager`): tugmani yashirish himoya emas.
 * To'lovning kirim yozuvi YUMSHOQ o'chiriladi — kassa qoldig'idan chiqadi,
 * lekin savatda va auditda qoladi (`lib/crm/tolovQoshish.ts`).
 */
export const DELETE = withTenant<{ params: { id: string; tolovId: string } }>(
  async (_request, { params }, { session: user }) => {
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    await zakazTolovniOchirish({
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
