import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { kategoriyaAzolariniSaqlash } from "@/lib/services/xodimKategoriya";
import { kategoriyaAzolarSchema } from "@/lib/validation/xodimKategoriya";

/**
 * Kategoriya a'zoligini TO'LIQ almashtirish (tanlangan xodimlar ro'yxati).
 * A'zolikdan chiqarish tarixga ta'sir qilmaydi — zakaz biriktiruvlari
 * (DealEmployee) alohida jadvalda qoladi.
 */
export const PUT = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = kategoriyaAzolarSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(
      await kategoriyaAzolariniSaqlash(businessId, params.id, parsed.data.employeeIds)
    );
  },
  { module: "HR" }
);
