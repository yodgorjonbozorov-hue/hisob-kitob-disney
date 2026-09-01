"use client";

import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { uzOyNomi } from "@/lib/format";
import { songa } from "./sozlamaShakl";

export interface PlanQiymatlari {
  mavsumOylar: number[];
  mavsumPlan: number;
  mavsumsizPlan: number;
  planBonus: number;
  boshlangichBall: number;
  kunlikLimit: number;
}

/** SOTUV PLANI, PLAN BONUSI VA BALL SOZLAMALARI. */
export function PlanTahrir({
  qiymat,
  onChange,
}: {
  qiymat: PlanQiymatlari;
  onChange: (v: PlanQiymatlari) => void;
}) {
  function oyniAlmashtir(oy: number) {
    onChange({
      ...qiymat,
      mavsumOylar: qiymat.mavsumOylar.includes(oy)
        ? qiymat.mavsumOylar.filter((o) => o !== oy)
        : [...qiymat.mavsumOylar, oy].sort((a, b) => a - b),
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Sotuv plani va ball</h2>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="mavsum-plan">
            Mavsum plani (so&apos;m)
          </label>
          <input
            id="mavsum-plan"
            value={qiymat.mavsumPlan.toLocaleString("uz-UZ")}
            onChange={(e) => onChange({ ...qiymat, mavsumPlan: songa(e.target.value) })}
            className={INPUT_CLASS}
            inputMode="numeric"
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="mavsumsiz-plan">
            Mavsumsiz plan (so&apos;m)
          </label>
          <input
            id="mavsumsiz-plan"
            value={qiymat.mavsumsizPlan.toLocaleString("uz-UZ")}
            onChange={(e) => onChange({ ...qiymat, mavsumsizPlan: songa(e.target.value) })}
            className={INPUT_CLASS}
            inputMode="numeric"
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="plan-bonus">
            Plan bajarilsa bonus (so&apos;m)
          </label>
          <input
            id="plan-bonus"
            value={qiymat.planBonus.toLocaleString("uz-UZ")}
            onChange={(e) => onChange({ ...qiymat, planBonus: songa(e.target.value) })}
            className={INPUT_CLASS}
            inputMode="numeric"
          />
        </div>
      </div>

      <p className={`${LABEL_CLASS} mt-4`}>Mavsum oylari</p>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((oy) => (
          <button
            key={oy}
            type="button"
            onClick={() => oyniAlmashtir(oy)}
            aria-pressed={qiymat.mavsumOylar.includes(oy)}
            className={`rounded-full px-3 py-1 text-2xs border transition ${
              qiymat.mavsumOylar.includes(oy)
                ? "border-brand bg-brand-wash text-brand"
                : "border-line text-muted hover:bg-surface-2"
            }`}
          >
            {uzOyNomi(oy - 1)}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="boshlangich-ball">
            Boshlang&apos;ich ball (har oy)
          </label>
          <input
            id="boshlangich-ball"
            value={qiymat.boshlangichBall}
            onChange={(e) => onChange({ ...qiymat, boshlangichBall: songa(e.target.value) })}
            className={INPUT_CLASS}
            inputMode="numeric"
          />
          <p className="text-2xs text-faint mt-1">
            Ball keyingi oyga ko&apos;chmaydi — har oy shu qiymatdan boshlanadi.
          </p>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="kunlik-limit">
            Kunlik jarima limiti (ball)
          </label>
          <input
            id="kunlik-limit"
            value={qiymat.kunlikLimit}
            onChange={(e) => onChange({ ...qiymat, kunlikLimit: songa(e.target.value) })}
            className={INPUT_CLASS}
            inputMode="numeric"
          />
          <p className="text-2xs text-faint mt-1">
            Ishonch buzilishi (kritik) sabablar bu limitga kirmaydi.
          </p>
        </div>
      </div>
    </section>
  );
}
