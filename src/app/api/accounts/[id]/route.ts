import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { updateAccount, deleteAccount } from "@/lib/services/accounts";
import { updateAccountSchema } from "@/lib/validation/account";
import { dashboardYangilandi } from "@/lib/cache";

export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = updateAccountSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const account = await updateAccount(businessId, params.id, parsed.data);
    // `isActive` almashsa kassa qoldig'i "faol" dan "nofaol" ga ko'chadi —
    // dashboard kartasidagi ikkala raqam ham o'zgaradi.
    dashboardYangilandi(businessId);
    return NextResponse.json(account);
  }
);

export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const natija = await deleteAccount(businessId, params.id);
    dashboardYangilandi(businessId);
    return NextResponse.json(natija);
  }
);
