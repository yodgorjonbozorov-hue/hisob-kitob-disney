import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { qarzBekorSchema } from "@/lib/validation/qarz";
import { resolveActiveBusinessId } from "@/lib/business";
import { qarzBekor } from "@/lib/services/qarz";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * Qarzni bekor qilish — faqat boshqaruvchi.
 *
 * Yozuv o'chirilmaydi: sabab, kim va qachon bekor qilgani saqlanadi.
 * To'lovi bo'lgan qarz bekor qilinmaydi (xizmat qatlamida tekshiriladi).
 */
export const POST = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const parsed = qarzBekorSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const qarz = await qarzBekor({
    businessId,
    debtId: params.id,
    userId: user.userId,
    sabab: parsed.data.sabab,
  });

  dashboardYangilandi(businessId);
  return NextResponse.json({ id: qarz.id, status: qarz.status, isYopilgan: qarz.isYopilgan });
});
