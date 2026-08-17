import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { listKutilayotganTransferlar } from "@/lib/queries/accounts";
import { kassaTransferYarat } from "@/lib/services/kassaTransfer";
import { kassaTransferSchema } from "@/lib/validation/account";
import { requirePermission } from "@/lib/permissions/tekshir";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * KASSADAN KASSAGA O'TKAZMA (tasdiq bilan).
 *
 * Bu route kirim/chiqim yozmaydi — pul biznes ichida joyini o'zgartiradi,
 * xolos (lib/services/kassaTransfer.ts). Shuning uchun savdo, xarajat va sof
 * foyda raqamlari o'zgarmaydi.
 */

/** GET — tasdiq kutayotgan o'tkazmalar (kassalarni ko'rish huquqi yetarli). */
export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  await requirePermission(user.userId, "kassa.korish");
  return NextResponse.json(await listKutilayotganTransferlar(businessId));
});

/** POST — yangi o'tkazma. Qabul qiluvchi boshqa odam bo'lsa tasdiq kutadi. */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  await requirePermission(user.userId, "pul.berish");

  const parsed = kassaTransferSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  const transfer = await kassaTransferYarat(
    businessId,
    { userId: user.userId, ism: user.ism, rol: user.rol },
    parsed.data
  );
  dashboardYangilandi(businessId);
  return NextResponse.json(transfer, { status: 201 });
});
