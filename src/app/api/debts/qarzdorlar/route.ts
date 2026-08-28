import { NextResponse } from "next/server";
import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { listQarzdorlar, type QarzdorFiltr } from "@/lib/queries/qarz";

/**
 * QARZDORLAR RO'YXATI (shaxs kesimi) — mobil klient uchun.
 * Veb bu ro'yxatni server komponentda (`/app/qarzlar`) oladi; bu route xuddi
 * shu `listQarzdorlar` so'rovini HTTP orqali ochadi: 1 mijoz = 1 qator,
 * jamlash (konsolidatsiya) SERVERDA bajariladi.
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);

  const sp = new URL(request.url).searchParams;
  const tartib = sp.get("tartib");
  const filtr: QarzdorFiltr = {
    turi: sp.get("turi"),
    q: sp.get("q"),
    tartib:
      tartib === "kritik" || tartib === "summa" || tartib === "muddat" || tartib === "ism"
        ? tartib
        : null,
  };
  return NextResponse.json(await listQarzdorlar(businessId, filtr));
});
