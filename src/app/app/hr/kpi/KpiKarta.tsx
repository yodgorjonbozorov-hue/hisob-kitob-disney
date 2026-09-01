"use client";

import Link from "next/link";
import { Money } from "@/components/ui/Money";
import type { XodimOylikHisobi } from "@/lib/kpi/oylik";
import { XodimAvatar } from "../XodimAvatar";
import { BallBelgi, BallChizigi, PlanChizigi, qisqaSumma } from "./kpiUi";

/**
 * XODIM KPI KARTOCHKASI — mobile-first.
 *
 * Kartaning butun mazmuni bitta savolga javob beradi: "bu xodimga hozir
 * qancha oylik chiqdi". Shu bois oylik summasi eng katta element, qolgani
 * (sotuv, plan, ball) uni tushuntiruvchi kontekst.
 */
export function KpiKarta({
  xodim,
  boshlangichBall,
  orin,
  oy,
}: {
  xodim: XodimOylikHisobi;
  boshlangichBall: number;
  /** Reytingdagi o'rni (1 dan) — faqat rahbar ko'rinishida. */
  orin: number | null;
  oy: string;
}) {
  const havola = `/app/hr/kpi/${xodim.employeeId}?oy=${oy}`;
  const medal = orin === 1 ? "🏆" : orin === 2 ? "🥈" : orin === 3 ? "🥉" : null;

  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-4 ${xodim.isActive ? "" : "opacity-60"}`}
    >
      <div className="flex items-start gap-3">
        <Link href={havola} className="shrink-0">
          <XodimAvatar ism={xodim.ism} rasmUrl={xodim.rasmUrl} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={havola} className="font-bold text-fg truncate hover:text-brand">
              {xodim.ism}
            </Link>
            {orin !== null && (
              <span className="text-2xs text-faint tnum shrink-0">{medal ?? `${orin}.`}</span>
            )}
          </div>
          <p className="text-2xs text-muted truncate">{xodim.lavozim ?? "—"}</p>
        </div>
        <BallBelgi holat={xodim.ballHolati} />
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="text-2xs text-muted">Sotuv</p>
        <p className="text-sm font-medium text-fg tnum">{qisqaSumma(xodim.sotuv)} so&apos;m</p>
      </div>

      <div className="mt-2">
        <PlanChizigi sotuv={xodim.sotuv} plan={xodim.plan} foiz={xodim.planFoizi} compact />
      </div>

      <div className="mt-2">
        <BallChizigi ball={xodim.ortachaBall} boshlangich={boshlangichBall} compact />
      </div>

      <Link
        href={havola}
        className="mt-3 block rounded-xl bg-surface-2 px-3 py-2.5 hover:bg-brand-wash transition"
      >
        <p className="text-2xs text-muted">
          {xodim.yakuniy ? "Yakuniy oylik" : "Hozirgi hisob bo'yicha oylik"}
        </p>
        <Money value={xodim.jami} size="xl" tone="brand" />
      </Link>

      {!xodim.userId && (
        <p className="mt-2 text-2xs text-faint">
          Tizim hisobi bog&apos;lanmagan — sotuv avtomatik hisoblanmaydi.
        </p>
      )}
    </div>
  );
}
