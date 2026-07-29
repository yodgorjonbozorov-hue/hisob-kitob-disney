import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { getEnabledModules } from "@/lib/modules/guard";
import { aiSuhbat, AiSozlanmaganError } from "@/lib/ai/claude";
import { aiLimitTekshir } from "@/lib/ai/limit";
import { z } from "zod";

const schema = z.object({
  savol: z.string().trim().min(1, "Savol kiriting").max(1000),
  tarix: z
    .array(z.object({ rol: z.enum(["user", "assistant"]), matn: z.string().max(4000) }))
    .max(20)
    .optional(),
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

    try {
      const yoqilganModullar = await getEnabledModules(ctx);
      const javob = await aiSuhbat({
        savol: parsed.data.savol,
        tarix: parsed.data.tarix ?? [],
        ctx: { businessId, yoqilganModullar },
      });
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
