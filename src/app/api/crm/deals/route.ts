import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { createDeal } from "@/lib/crm/service";
import { buyurtmaSchema } from "@/lib/validation/crm";
import { dashboardYangilandi } from "@/lib/cache";

/** Yangi kunlik buyurtma (kategoriya + mijoz + narx + sana). */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = buyurtmaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    // SOTUVCHI TANLASH HUQUQI (5/27-talab): huquqsiz foydalanuvchi zakazni
    // faqat O'Z nomiga yozadi — xizmat qatlami buni majburlaydi.
    const sotuvchiTanlashHuquqi = await hasPermission(user.userId, "crm.sotuvchi");
    const deal = await createDeal({
      businessId,
      userId: user.userId,
      sotuvchiTanlashHuquqi,
      ...parsed.data,
    });
    // Dashboard "Bugungi holat" bloki bugungi buyurtmalarni sanaydi.
    dashboardYangilandi(businessId);
    return NextResponse.json(deal, { status: 201 });
  },
  { module: "CRM" }
);
