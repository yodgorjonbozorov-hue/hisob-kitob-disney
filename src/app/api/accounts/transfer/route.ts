import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { createTransfer } from "@/lib/services/accounts";
import { transferSchema } from "@/lib/validation/account";
import { dashboardYangilandi } from "@/lib/cache";

/** Kassalar aro pul ko'chirish — faqat direktor/admin. */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const parsed = transferSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const transfer = await createTransfer(businessId, user.userId, parsed.data);
  dashboardYangilandi(businessId);
  return NextResponse.json(transfer, { status: 201 });
});
