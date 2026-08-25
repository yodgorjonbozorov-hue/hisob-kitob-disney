import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { getActiveBusiness } from "@/lib/business";
import { aiRuxsatniHisobla } from "@/lib/ai/ruxsat";
import { boshSavollar } from "@/lib/ai/takliflar";
import { bugungiXulosa } from "@/lib/ai/xulosa";
import { suhbatlarRoyxati } from "@/lib/ai/suhbatlar";
import { AiChat } from "./AiChat";

/** AI Copilot — biznes ma'lumotlari bo'yicha suhbat. */
export default async function AiPage() {
  const ctx = await requireTenantPage();
  return runWithTenant(ctx.tenantId, async () => {
    await requireModulePage(ctx, "AI");
    const business = await getActiveBusiness(ctx.session);
    const aiUlangan = !!process.env.ANTHROPIC_API_KEY;

    if (!business) {
      return (
        <div className="space-y-3">
          <h1 className="text-xl font-bold text-fg">Balansa AI</h1>
          <p className="text-muted text-sm">Sizga biznes biriktirilmagan. Administrator bilan bog'laning.</p>
        </div>
      );
    }

    const ruxsat = await aiRuxsatniHisobla(ctx, business.id, business.omborli);
    // Bosh ekrandagi kesim va tayyor savollar DETERMINISTIK: sahifa ochilishi
    // birorta ham AI so'rovi (va token) sarflamaydi.
    const [xulosa, suhbatlar] = await Promise.all([
      bugungiXulosa(ruxsat),
      suhbatlarRoyxati({ businessId: business.id, userId: ctx.session.userId }),
    ]);

    return (
      <AiChat
        biznesNomi={business.nomi}
        aiUlangan={aiUlangan}
        savollar={boshSavollar(ruxsat)}
        xulosa={xulosa}
        suhbatlar={suhbatlar}
      />
    );
  });
}
