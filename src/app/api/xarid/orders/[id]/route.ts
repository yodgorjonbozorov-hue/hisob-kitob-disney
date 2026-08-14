import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { updateOrder, qabulQilish, orderHolatiniOzgartir } from "@/lib/services/xarid";
import { updateOrderSchema, orderHolatSchema } from "@/lib/validation/xarid";
import { dashboardYangilandi } from "@/lib/cache";

/** Qoralama buyurtmani tahrirlash. */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = updateOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await updateOrder(businessId, params.id, parsed.data));
  },
  { module: "XARID" }
);

/**
 * Holatni o'zgartirish: tasdiqlash, bekor qilish yoki QABUL QILISH.
 * Qabul qilish — ombor va pul yozuvlarini yaratadigan yagona qadam.
 */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = orderHolatSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    if (parsed.data.holat === "qabul_qilingan") {
      await requireOmborli(businessId);
      const order = await qabulQilish({
        businessId,
        orderId: params.id,
        userId: user.userId,
        qabulSana: parsed.data.qabulSana,
        tolanganSumma: parsed.data.tolanganSumma,
        accountId: parsed.data.accountId,
      });
      dashboardYangilandi(businessId);
      return NextResponse.json(order);
    }

    return NextResponse.json(
      await orderHolatiniOzgartir({ businessId, orderId: params.id, holat: parsed.data.holat })
    );
  },
  { module: "XARID" }
);
