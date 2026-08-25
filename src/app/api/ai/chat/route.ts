import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/tenant";
import { getActiveBusiness, resolveActiveBusinessId } from "@/lib/business";
import { aiSuhbat, AiSozlanmaganError } from "@/lib/ai/claude";
import { aiLimitTekshir } from "@/lib/ai/limit";
import { aiRuxsatniHisobla } from "@/lib/ai/ruxsat";
import { davrniHal } from "@/lib/ai/davr";
import { keyingiTakliflar } from "@/lib/ai/takliflar";
import { suhbatgaYoz, suhbatniOl } from "@/lib/ai/suhbatlar";
import { todayTashkentDateOnlyString } from "@/lib/date";

/**
 * AI COPILOT SUHBATI.
 *
 * Mijoz FAQAT savol, suhbat ID'si va tanlangan davrni yuboradi. Tarix
 * serverda (`lib/ai/suhbatlar.ts`), biznes esa autentifikatsiyalangan
 * kontekstdan (`resolveActiveBusinessId`) — so'rov tanasidagi hech qanday
 * maydon biznesni yoki ruxsatni o'zgartira olmaydi.
 */
const schema = z.object({
  savol: z.string().trim().min(1, "Savol kiriting").max(500),
  /** Davom etayotgan suhbat. Berilmasa — yangi suhbat ochiladi. */
  suhbatId: z.string().trim().max(40).nullish(),
  /** Sahifada tanlangan davr ("oy", "bugun", "2026-07" ...). */
  davr: z.string().trim().max(30).nullish(),
});

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

    const business = await getActiveBusiness(ctx.session);
    const kalit = { businessId, userId: ctx.session.userId };
    const suhbatId = parsed.data.suhbatId?.trim() || null;

    try {
      const [ruxsat, mavjud] = await Promise.all([
        aiRuxsatniHisobla(ctx, businessId, business?.omborli ?? false),
        suhbatId ? suhbatniOl(kalit, suhbatId) : Promise.resolve(null),
      ]);

      const natija = await aiSuhbat({
        savol: parsed.data.savol,
        // Begona/eskirgan ID bo'lsa `mavjud` null — suhbat toza boshlanadi.
        tarix: mavjud?.xabarlar ?? [],
        ruxsat,
        davr: davrniHal(parsed.data.davr),
        biznesNomi: business?.nomi ?? "—",
        bugun: todayTashkentDateOnlyString(),
      });

      const takliflar = keyingiTakliflar(natija.ishlatilganToollar, ruxsat);
      const suhbat = await suhbatgaYoz(
        { ...kalit, tenantId: ctx.tenantId },
        mavjud?.id ?? null,
        { rol: "user", matn: parsed.data.savol },
        { rol: "assistant", matn: natija.javob, havolalar: natija.havolalar, takliflar }
      );

      return NextResponse.json({
        javob: natija.javob,
        havolalar: natija.havolalar,
        takliflar,
        suhbatId: suhbat.id,
        sarlavha: suhbat.sarlavha,
        qoldi: limit.qoldi,
      });
    } catch (error) {
      if (error instanceof AiSozlanmaganError) {
        return NextResponse.json(
          { error: "AI hali ulanmagan — administrator ANTHROPIC_API_KEY sozlashi kerak." },
          { status: 503 }
        );
      }
      // Texnik tafsilot faqat serverda qoladi — foydalanuvchiga tushunarli xabar.
      console.error("AI suhbat xatosi:", error);
      return NextResponse.json(
        { error: "Ma'lumotlarni tahlil qilishda xatolik yuz berdi." },
        { status: 502 }
      );
    }
  },
  { module: "AI" }
);
