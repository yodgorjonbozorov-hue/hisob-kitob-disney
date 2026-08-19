import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireMagazin } from "@/lib/business";
import { posChekBekorSchema } from "@/lib/validation/pos";
import { posChekBekor } from "@/lib/services/pos";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * CHEKNI QAYTARISH — faqat boshqaruvchi (OWNER/ADMIN).
 *
 * Qaytarish kassadan pul chiqaradi va omborga tovar qaytaradi, ya'ni bu
 * moliyaviy qaror. Sotuvni bekor qilish (`/api/sales/[id]`) bilan bir xil
 * qoida — kassirga ochilmaydi.
 */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireMagazin(businessId);

    const parsed = posChekBekorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const natija = await posChekBekor({
      businessId,
      chekId: params.id,
      sabab: parsed.data.sabab,
      userId: user.userId,
    });

    dashboardYangilandi(businessId);
    return NextResponse.json(natija);
  },
  { module: "MAGAZIN" }
);
