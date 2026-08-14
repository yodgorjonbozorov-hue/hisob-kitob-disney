import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { createTransfer } from "@/lib/services/accounts";
import { createUserTransfer } from "@/lib/services/userKassa";
import { transferSchema, userTransferSchema } from "@/lib/validation/account";
import { requirePermission } from "@/lib/permissions/tekshir";
import { requirePro } from "@/lib/billing/pro";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * Pul ko'chirish. Ikki rejim:
 *  - kassadan kassaga (fromAccountId + toAccountId) — faqat direktor/admin;
 *  - FOYDALANUVCHIGA (toUserId, PRO) — "pul.berish" huquqi bo'lgan har kim:
 *    o'z shaxsiy kassasidan boshqa foydalanuvchining kassasiga o'tkazadi.
 */
export const POST = withTenant(async (request, _ctx, tenant) => {
  const user = tenant.session;
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();

  if (body && typeof body === "object" && typeof body.toUserId === "string") {
    requirePro(tenant);
    await requirePermission(user.userId, "pul.berish");
    const parsed = userTransferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    const transfer = await createUserTransfer({
      businessId,
      actorId: user.userId,
      actorRol: user.rol,
      data: parsed.data,
    });
    dashboardYangilandi(businessId);
    return NextResponse.json(transfer, { status: 201 });
  }

  requireManager(user.rol);
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const transfer = await createTransfer(businessId, user.userId, parsed.data);
  dashboardYangilandi(businessId);
  return NextResponse.json(transfer, { status: 201 });
});
