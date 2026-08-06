import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { getEnabledModules } from "@/lib/modules/guard";
import { aiSuhbat, AiSozlanmaganError } from "@/lib/ai/claude";
import { aiLimitTekshir } from "@/lib/ai/limit";
import { tarixniOl, tarixgaYoz, tarixniTozala } from "@/lib/ai/suhbat";
import { z } from "zod";

/**
 * Mijoz FAQAT savol yuboradi. Suhbat tarixi serverda saqlanadi (lib/ai/suhbat.ts) —
 * ilgari tarix mijozdan kelardi va soxta `assistant` xabari bilan modelni
 * chalg'itish mumkin edi (prompt injection, S-7).
 */
const schema = z.object({
  savol: z.string().trim().min(1, "Savol kiriting").max(1000),
  /** true bo'lsa oldingi suhbat unutiladi ("Yangi suhbat"). */
  yangiSuhbat: z.boolean().optional(),
});

/** AI yordamchi bilan suhbat. AI faqat tenant-scoped tool'lar orqali ma'lumot ko'radi. */
export const POST = withTenant(
  async (request, _routeCtx, ctx) => {
    const businessId = await resolveActiveBusinessId(ctx.session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const limit = await aiLimitTekshir(ctx.tenantId);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Bugungi AI so'rovlar limiti tugadi. Ertaga davom etasiz." },
        { status: 429 }
      );
    }

    const kalit = { businessId, userId: ctx.session.userId };
    if (parsed.data.yangiSuhbat) {
      await tarixniTozala(kalit);
    }

    try {
      const [yoqilganModullar, tarix] = await Promise.all([
        getEnabledModules(ctx),
        tarixniOl(kalit),
      ]);
      const javob = await aiSuhbat({
        savol: parsed.data.savol,
        tarix,
        ctx: { businessId, yoqilganModullar },
      });
      await tarixgaYoz({ ...kalit, tenantId: ctx.tenantId }, parsed.data.savol, javob);
      return NextResponse.json({ javob, qoldi: limit.qoldi });
    } catch (error) {
      if (error instanceof AiSozlanmaganError) {
        return NextResponse.json(
          { error: "AI hali ulanmagan — administrator ANTHROPIC_API_KEY sozlashi kerak." },
          { status: 503 }
        );
      }
      console.error("AI suhbat xatosi:", error);
      return NextResponse.json({ error: "AI javob bera olmadi — birozdan keyin urining." }, { status: 502 });
    }
  },
  { module: "AI" }
);
