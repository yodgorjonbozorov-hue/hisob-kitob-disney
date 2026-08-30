"use client";

import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import type { XodimPerformanceDTO, PlanDTO } from "@/lib/queries/xodimPlan";
import type { XodimVazifaDTO } from "@/lib/services/xodimVazifa";
import { PLAN_NOMI, PLAN_BIRLIK } from "@/lib/validation/hr";
import { planQiymat, foizRang } from "../../PlanProgress";

/** UMUMIY TAB — oy KPI'lari va oylik plan tarixi. */
export function UmumiyTab({
  performance,
  planTarixi,
  vazifalar,
}: {
  performance: XodimPerformanceDTO | null;
  planTarixi: PlanDTO[];
  vazifalar: XodimVazifaDTO[];
}) {
  const p = performance;
  const kechikkan = p?.vazifa.kechikkan ?? 0;
  const ortacha = p && p.zakazlar > 0 ? Math.round(p.savdo / p.zakazlar) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="text-2xs text-muted">Zakazlar</p>
          <p className="text-xl font-bold text-fg tnum">{p?.zakazlar ?? 0}</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xs text-muted">Savdo summasi</p>
          <Money value={p?.savdo ?? 0} size="lg" tone="income" />
        </Card>
        <Card className="p-3">
          <p className="text-2xs text-muted">O&apos;rtacha zakaz</p>
          <Money value={ortacha} size="lg" tone="neutral" />
        </Card>
        <Card className="p-3">
          <p className="text-2xs text-muted">Vazifalar</p>
          <p className="text-xl font-bold text-fg tnum">
            {p ? `${p.vazifa.bajarildi} / ${p.vazifa.jami}` : "0 / 0"}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-2xs text-muted">Kechikkan vazifa</p>
          <p className={`text-xl font-bold tnum ${kechikkan > 0 ? "text-expense" : "text-fg"}`}>
            {kechikkan}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-2xs text-muted">Plan bajarilishi</p>
          <p
            className={`text-xl font-bold tnum ${
              p?.plan && p.plan.foiz >= 100 ? "text-income" : "text-fg"
            }`}
          >
            {p?.plan ? `${p.plan.foiz}%` : "—"}
          </p>
        </Card>
      </div>

      {p && !p.userId && (
        <p className="text-2xs text-warning">
          Xodim tizim hisobiga bog&apos;lanmagan — zakaz/savdo ko&apos;rsatkichlari 0
          bo&apos;lib qoladi. Admin → Foydalanuvchilar bo&apos;limida hisob ochib, xodim
          kartochkasiga bog&apos;lash mumkin.
        </p>
      )}

      <Card>
        <p className="font-bold text-fg mb-2">Oylik plan tarixi</p>
        {planTarixi.length === 0 ? (
          <p className="text-sm text-muted">Hali plan belgilanmagan.</p>
        ) : (
          <div className="space-y-3">
            {planTarixi.map((t) => (
              <div key={t.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <p className="text-fg tnum font-medium">{t.oy}</p>
                  <p className="text-2xs text-muted tnum">
                    {PLAN_NOMI[t.planTuri]}: {planQiymat(t.planTuri, t.natija)} /{" "}
                    {planQiymat(t.planTuri, t.maqsad)} {PLAN_BIRLIK[t.planTuri]}
                  </p>
                  <p className={`font-bold tnum ${t.foiz >= 100 ? "text-income" : "text-fg"}`}>
                    {t.foiz}%
                  </p>
                </div>
                <div className="h-1.5 mt-1 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${foizRang(t.foiz)}`}
                    style={{ width: `${Math.min(100, t.foiz)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-2xs text-faint mt-3">
          Har oy plani alohida saqlanadi — keyingi oy plan o&apos;zgarsa o&apos;tgan oy foizi
          o&apos;zgarmaydi.
        </p>
      </Card>

      {vazifalar.some((v) => v.kechikkan) && (
        <Card>
          <p className="font-bold text-expense mb-2">
            {vazifalar.filter((v) => v.kechikkan).length} ta kechikkan vazifa
          </p>
          <ul className="space-y-1">
            {vazifalar
              .filter((v) => v.kechikkan)
              .map((v) => (
                <li key={v.id} className="text-sm text-fg flex justify-between gap-2">
                  <span className="truncate">❌ {v.nomi}</span>
                  <span className="text-2xs text-muted tnum shrink-0">muddat: {v.muddat}</span>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
