import Link from "next/link";
import { requireBillingPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/auth/roles";
import { PLANLAR } from "@/lib/billing/plans";
import { formatDateUZ } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { BillingClient } from "./BillingClient";
import { mavjudProviderlar } from "@/lib/billing/provider";

export const metadata = { title: "Obuna va to'lov" };

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  TRIAL: { text: "Bepul sinov", cls: "bg-brand-wash text-brand" },
  ACTIVE: { text: "Faol obuna", cls: "bg-income-soft text-income-fg" },
  PAST_DUE: { text: "To'lov kutilmoqda", cls: "bg-expense-soft text-expense-fg" },
  BLOCKED: { text: "Bloklangan", cls: "bg-expense-soft text-expense-fg" },
};

export default async function BillingPage() {
  const { session, tenantId, tenant, access } = await requireBillingPage();
  return runWithTenant(tenantId, async () => {
    const [pendingPayments, subscriptions] = await Promise.all([
      prisma.payment.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.subscription.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

    const st = STATUS_LABEL[tenant.status] ?? { text: tenant.status, cls: "bg-surface-2 text-fg" };
    const deadline = tenant.status === "TRIAL" ? tenant.trialEndsAt : tenant.currentPeriodEnd;
    const manager = isManager(session.rol);
    // Onlayn to'lov usullari faqat env sozlangan bo'lsa ko'rinadi.
    const providerlar = mavjudProviderlar();

    return (
      <div className="min-h-screen bg-app px-4 py-10">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Logo variant="icon" height={36} />
            <div>
              <h1 className="font-heading text-2xl font-bold text-fg">Obuna va to'lov</h1>
              <p className="text-sm text-muted">{tenant.name}</p>
            </div>
          </div>

          {/* Joriy holat */}
          <div className="bg-surface rounded-2xl border border-line shadow-card p-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  tenant.bepul ? "bg-income-soft text-income-fg" : st.cls
                }`}
              >
                {tenant.bepul ? "Doimiy bepul" : st.text}
              </span>
              {!tenant.bepul && deadline && (
                <span className="text-sm text-muted">
                  Muddat: <span className="font-medium text-fg">{formatDateUZ(deadline)}</span>
                  {access.kunQoldi !== null && access.kunQoldi >= 0 && (
                    <span className="text-faint"> ({access.kunQoldi} kun qoldi)</span>
                  )}
                </span>
              )}
            </div>
            {access.sabab && <p className="text-sm text-expense-fg">{access.sabab}</p>}
            {access.ogohlantirish && <p className="text-sm text-fg">{access.ogohlantirish}</p>}
            {tenant.bepul ? (
              <p className="text-sm text-muted">
                Sizda doimiy bepul foydalanish — obuna muddati va to&apos;lov talab qilinmaydi.
              </p>
            ) : (
              access.mode === "FULL" &&
              !access.ogohlantirish && (
                <p className="text-sm text-muted">Hammasi joyida — tizimdan to&apos;liq foydalanishingiz mumkin.</p>
              )
            )}
          </div>

          {/* Tariflar + to'lov — doimiy bepul mijozga ko'rsatilmaydi. */}
          {!tenant.bepul &&
            PLANLAR.map((plan) => (
            <div key={plan.code} className="bg-surface rounded-2xl border border-line shadow-card p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-semibold text-fg text-lg">{plan.nomi}</h2>
                  <p className="text-sm text-muted mt-1">{plan.tavsif}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-fg tnum">{plan.oylikNarx.toLocaleString("ru-RU")}</p>
                  <p className="text-xs text-muted">so'm / oy</p>
                </div>
              </div>
              <div className="mt-4">
                {manager ? (
                  <BillingClient planCode={plan.code} providerlar={providerlar} />
                ) : (
                  <p className="text-sm text-faint">To'lov qilish uchun direktorga murojaat qiling.</p>
                )}
              </div>
            </div>
          ))}

          {/* Kutilayotgan to'lovlar */}
          {pendingPayments.length > 0 && (
            <div className="bg-surface rounded-2xl border border-line shadow-card p-6">
              <h3 className="font-semibold text-fg mb-3">Kutilayotgan to'lovlar</h3>
              <div className="divide-y divide-line text-sm">
                {pendingPayments.map((p) => (
                  <div key={p.id} className="py-2 flex items-center justify-between gap-3">
                    <span className="text-muted truncate">№ {p.id}</span>
                    <span className="tnum font-medium text-fg">{p.amount.toLocaleString("ru-RU")} so'm</span>
                    <span className="text-xs text-faint">tasdiq kutilmoqda</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Obuna tarixi */}
          {subscriptions.length > 0 && (
            <div className="bg-surface rounded-2xl border border-line shadow-card p-6">
              <h3 className="font-semibold text-fg mb-3">Obuna tarixi</h3>
              <div className="divide-y divide-line text-sm">
                {subscriptions.map((s) => (
                  <div key={s.id} className="py-2 flex items-center justify-between gap-3">
                    <span className="text-muted">
                      {formatDateUZ(s.periodStart)} — {formatDateUZ(s.periodEnd)}
                    </span>
                    <span className="tnum font-medium text-fg">{s.amount.toLocaleString("ru-RU")} so'm</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <Link href="/app" className="text-sm text-brand hover:underline">
              ← Ilovaga qaytish
            </Link>
          </div>
        </div>
      </div>
    );
  });
}
