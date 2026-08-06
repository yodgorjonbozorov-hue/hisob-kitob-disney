import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { cancelSale } from "@/lib/services/inventory";
import { cancelSaleSchema } from "@/lib/validation/inventory";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * Sotuvni bekor qilish (B-4).
 *
 * Faqat direktor/admin: kassir o'z xatosini o'zi "yo'q qila olmasligi" kerak —
 * aks holda kassa nazorati ma'nosini yo'qotadi. Sabab majburiy va audit
 * jurnaliga tushadi.
 */
export const DELETE = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireOmborli(businessId);

    const parsed = cancelSaleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const natija = await cancelSale({
      businessId,
      saleId: params.id,
      sabab: parsed.data.sabab,
      userId: user.userId,
    });

    dashboardYangilandi(businessId);
    return NextResponse.json(natija);
  },
  { module: "OMBOR" }
);
