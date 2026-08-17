import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { resolveActiveBusinessId } from "@/lib/business";
import { getQarzdorTafsilot } from "@/lib/queries/qarz";

/**
 * BITTA QARZDORNING TAFSILOTI — barcha qarzlari va to'lovlari bitta tarixda.
 *
 * `/api/debts/[id]` bitta QARZ YOZUVI haqida; bu esa SHAXS haqida: mijozning
 * o'nta qarzi bo'lsa ham "qancha qarzdor" degan savolga bitta javob kerak.
 *
 * Kalit yo'l (path) bo'lagi emas, QUERY parametri: u `ism:ali valiyev`
 * ko'rinishida bo'lishi mumkin — bo'shliq va ikki nuqta bilan.
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const kalit = searchParams.get("kalit");
  const turi = searchParams.get("turi");
  if (!kalit) return NextResponse.json({ error: "Qarzdor kaliti berilmadi" }, { status: 400 });
  if (turi !== "olinadigan" && turi !== "beriladigan") {
    return NextResponse.json({ error: "Qarz yo'nalishi noto'g'ri" }, { status: 400 });
  }

  const qarzdor = await getQarzdorTafsilot(businessId, turi, kalit);
  if (!qarzdor) return NextResponse.json({ error: "Qarzdor topilmadi" }, { status: 404 });
  return NextResponse.json(qarzdor);
});
