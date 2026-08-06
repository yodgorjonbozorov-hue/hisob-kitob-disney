import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { getActiveBusiness } from "@/lib/business";
import { getNotificationCount } from "@/lib/queries/notifications";

/**
 * Nav badge uchun bildirishnoma soni. Ilgari bu hisob layout'da sahifa
 * renderini bloklab turardi (~6 ketma-ket DB so'rovi) — endi sahifa ochilgach
 * clientdan alohida so'raladi, sekin bo'lsa ham sahifani ushlab qolmaydi.
 */
export const GET = withTenant(async (_request, _ctx, { session }) => {
  const business = await getActiveBusiness(session);
  if (!business) {
    return NextResponse.json({ count: 0 });
  }
  const count = await getNotificationCount(business.id, {
    rol: session.rol,
    omborli: business.omborli,
  }).catch(() => 0);
  return NextResponse.json({ count });
});
