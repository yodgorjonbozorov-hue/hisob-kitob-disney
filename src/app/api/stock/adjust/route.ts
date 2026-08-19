import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { adjustStock } from "@/lib/services/stockAdjust";
import { adjustStockSchema } from "@/lib/validation/inventory";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * Inventarizatsiya yoki hisobdan chiqarish — faqat direktor/admin.
 * Kassir qoldiqni o'zi to'g'rilay olmasligi kerak: aks holda kamomad
 * shunchaki "tuzatib" qo'yilardi.
 */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  await requireOmborli(businessId);

  const parsed = adjustStockSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const natija = await adjustStock({
    businessId,
    productId: parsed.data.productId,
    turi: parsed.data.turi,
    miqdor: parsed.data.miqdor,
    sabab: parsed.data.sabab,
    userId: user.userId,
  });

  // Ombor qoldig'i o'zgardi — bosh sahifadagi "Ombordagi mahsulotlar"
  // kartasi eskirib qolmasin.
  dashboardYangilandi(businessId);
  return NextResponse.json(natija, { status: 201 });
}, { module: "OMBOR" });
