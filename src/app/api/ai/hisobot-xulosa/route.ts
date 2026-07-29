import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { getMonthlyReport } from "@/lib/queries/report";
import { aiHisobotXulosa, AiSozlanmaganError } from "@/lib/ai/claude";
import { aiLimitTekshir } from "@/lib/ai/limit";
import { currentMonthString } from "@/lib/date";

/** Oylik hisobot uchun 1-klik AI xulosa. */
export const GET = withTenant(
  async (request, _ctx, ctx) => {
    requireManager(ctx.session.rol);
    const businessId = await resolveActiveBusinessId(ctx.session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const month = new URL(request.url).searchParams.get("month") ?? currentMonthString();

    const limit = await aiLimitTekshir(ctx.tenantId);
    if (!limit.ok) {
      return NextResponse.json({ error: "Bugungi AI limiti tugadi. Ertaga davom etasiz." }, { status: 429 });
    }

    try {
      const report = await getMonthlyReport(businessId, month);
      const xulosa = await aiHisobotXulosa(report);
      return NextResponse.json({ xulosa });
    } catch (error) {
      if (error instanceof AiSozlanmaganError) {
        return NextResponse.json(
          { error: "AI hali ulanmagan — administrator ANTHROPIC_API_KEY sozlashi kerak." },
          { status: 503 }
        );
      }
      console.error("AI hisobot xulosa xatosi:", error);
      return NextResponse.json({ error: "AI xulosa tayyorlay olmadi — birozdan keyin urining." }, { status: 502 });
    }
  },
  { module: "AI" }
);
