import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { getActiveBusiness } from "@/lib/business";
import { AiClient } from "./AiClient";

/** AI yordamchi — biznes raqamlari bo'yicha suhbat. */
export default async function AiPage() {
  const ctx = await requireTenantPage();
  return runWithTenant(ctx.tenantId, async () => {
    await requireModulePage(ctx, "AI");
    const business = await getActiveBusiness(ctx.session);
    const aiUlangan = !!process.env.ANTHROPIC_API_KEY;

    return (
      <div className="space-y-4 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-fg">AI yordamchi</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Raqamlaringiz
            bo'yicha savol bering
          </p>
        </div>
        {aiUlangan ? (
          <AiClient />
        ) : (
          <div className="bg-surface rounded-2xl border border-line p-6 text-center space-y-2">
            <p className="text-3xl">🔌</p>
            <p className="font-medium text-fg">AI hali ulanmagan</p>
            <p className="text-sm text-muted">
              Administrator serverga <code className="bg-surface-2 px-1.5 py-0.5 rounded">ANTHROPIC_API_KEY</code>{" "}
              qo'shishi bilan bu bo'lim ishga tushadi.
            </p>
          </div>
        )}
      </div>
    );
  });
}
