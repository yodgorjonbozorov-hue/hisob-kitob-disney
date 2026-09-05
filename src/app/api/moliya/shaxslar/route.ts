import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { requirePermission } from "@/lib/permissions/tekshir";
import { shaxsQidiruv } from "@/lib/queries/moliya";
import { isShaxsTuri, kartochkaliMi } from "@/lib/moliya/shaxs";

/**
 * TOMON QIDIRUVI — "Pul kimdan olindi / kimga berildi" maydoni uchun.
 * Kartochkasiz turlarda (boshqa shaxs, filial, boshqa) ro'yxat yo'q —
 * bo'sh massiv qaytadi va forma oddiy matn maydonida qoladi.
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  await requirePermission(user.userId, "tranzaksiya.yaratish");

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);

  const sp = new URL(request.url).searchParams;
  const turi = sp.get("turi");
  if (!isShaxsTuri(turi) || !kartochkaliMi(turi)) return NextResponse.json([]);

  return NextResponse.json(await shaxsQidiruv(businessId, turi, sp.get("q")));
});
