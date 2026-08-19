import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { hasPermission } from "@/lib/permissions/tekshir";
import { resolveActiveBusinessId } from "@/lib/business";
import { getKassaDetal } from "@/lib/queries/kassaDetal";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatToshkentVaqt } from "@/lib/format";
import { ACCOUNT_TURI_NOMI, type AccountTuri } from "@/lib/validation/account";

/**
 * BITTA KASSA DETALI — qoldiq, bugungi kesim va harakatlar tarixi.
 *
 * Tarix uch manbadan (kirim, chiqim, o'tkazmalar) yig'ilib bitta vaqt o'qiga
 * tiziladi (lib/queries/kassaDetal.ts): kassir "pul qayerdan keldi, qayerga
 * ketdi" savoliga bitta ro'yxatdan javob oladi.
 */
export default async function KassaDetalPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { session, tenantId } = await requireTenantPage();

  return runWithTenant(tenantId, async () => {
    if (!(await hasPermission(session.userId, "kassa.korish"))) {
      redirect("/app/tranzaksiyalar");
    }
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) notFound();

    const detal = await getKassaDetal(businessId, id);
    if (!detal) notFound();

    const { kassa, bugungiKirim, bugungiChiqim, harakatlar } = detal;

    return (
      <div className="space-y-6">
        <div>
          <Link href="/app/kassa" className="text-2xs text-muted hover:text-brand">
            ← Kassalar
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-fg mt-1">{kassa.nomi}</h1>
          <p className="text-sm text-muted mt-1">
            {kassa.userId
              ? `Shaxsiy kassa · ${kassa.egaIsm ?? "egasi o'chirilgan"}`
              : (ACCOUNT_TURI_NOMI[kassa.turi as AccountTuri] ?? kassa.turi)}
            {kassa.isActive ? "" : " · nofaol"}
          </p>
        </div>

        <Card>
          <p className="text-sm text-muted">Joriy balans</p>
          <Money
            value={kassa.qoldiq}
            size="display"
            tone={kassa.qoldiq >= 0 ? "brand" : "expense"}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-line">
            <div>
              <p className="text-2xs text-muted">Bugungi kirim</p>
              <Money value={bugungiKirim} size="md" tone="income" />
            </div>
            <div>
              <p className="text-2xs text-muted">Bugungi chiqim</p>
              <Money value={bugungiChiqim} size="md" tone="expense" />
            </div>
            <div>
              <p className="text-2xs text-muted">Kirgan o&apos;tkazma</p>
              <Money value={kassa.kirganTransfer} size="md" tone="neutral" />
            </div>
            <div>
              <p className="text-2xs text-muted">Chiqqan o&apos;tkazma</p>
              <Money value={kassa.chiqqanTransfer} size="md" tone="neutral" />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-fg mb-3">Kassa harakatlari</h2>
          {harakatlar.length === 0 ? (
            <EmptyState
              icon="📋"
              title="Harakat yo'q"
              description="Bu kassaga hali biror yozuv yoki o'tkazma bog'lanmagan."
            />
          ) : (
            <ul className="divide-y divide-line">
              {harakatlar.map((h) => (
                <li key={`${h.turi}-${h.id}`} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-fg truncate">{h.matn}</p>
                    <p className="text-2xs text-faint">{formatToshkentVaqt(new Date(h.vaqt))}</p>
                  </div>
                  <p
                    className={`text-sm font-semibold tnum shrink-0 ${
                      h.summa >= 0 ? "text-income" : "text-expense"
                    }`}
                  >
                    {h.summa >= 0 ? "+" : "−"}
                    {Math.abs(h.summa).toLocaleString("ru-RU")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  });
}
