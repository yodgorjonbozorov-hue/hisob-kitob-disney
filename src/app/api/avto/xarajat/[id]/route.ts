import { NextResponse } from "next/server";
import { requireManager, forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { deleteProductExpense } from "@/lib/services/inventory";

/** Xato kiritilgan xarajatni o'chirish (bog'langan chiqim ham bekor qilinadi). */
export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    forbidSeller(user.rol);
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    await deleteProductExpense({ businessId, expenseId: params.id, userId: user.userId });
    return NextResponse.json({ ok: true });
  },
  { module: "OMBOR" }
);
