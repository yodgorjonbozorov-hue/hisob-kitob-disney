import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { suhbatniOchir, suhbatniOl } from "@/lib/ai/suhbatlar";

interface RouteCtx {
  params: { id: string };
}

/**
 * Bitta suhbat xabarlari.
 *
 * Egalik so'rovning O'ZIDA: `(id, businessId, userId)` — begona suhbat ID'si
 * bilan ham 404 qaytadi (IDOR himoyasi), boshqa tenant esa `businessId`
 * orqali baribir tashqarida.
 */
export const GET = withTenant<RouteCtx>(
  async (_request, routeCtx, ctx) => {
    const businessId = await resolveActiveBusinessId(ctx.session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const suhbat = await suhbatniOl(
      { businessId, userId: ctx.session.userId },
      routeCtx.params.id
    );
    if (!suhbat) return NextResponse.json({ error: "Suhbat topilmadi" }, { status: 404 });
    return NextResponse.json(suhbat);
  },
  { module: "AI" }
);

/** Suhbatni o'chirish (faqat o'ziniki). */
export const DELETE = withTenant<RouteCtx>(
  async (_request, routeCtx, ctx) => {
    const businessId = await resolveActiveBusinessId(ctx.session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    await suhbatniOchir({ businessId, userId: ctx.session.userId }, routeCtx.params.id);
    return NextResponse.json({ ok: true });
  },
  { module: "AI" }
);
