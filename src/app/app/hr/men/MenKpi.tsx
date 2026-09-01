import Link from "next/link";
import { Money } from "@/components/ui/Money";
import type { XodimOylikHisobi } from "@/lib/kpi/oylik";
import { formatMonthLabel } from "@/lib/format";
import { parseMonthString } from "@/lib/date";
import { BallBelgi, BallChizigi, PlanChizigi, foizMatn, qisqaSumma } from "../kpi/kpiUi";

/**
 * "OYLIGIM" — xodimning O'Z KPI xulosasi.
 *
 * Xodim faqat o'zini ko'radi: bu blok serverda `userId` orqali topilgan
 * xodim yozuvi bo'yicha to'ldiriladi, boshqa xodimlarning raqamlari
 * brauzerga umuman yuborilmaydi.
 */
export function MenKpi({
  hisob,
  boshlangichBall,
}: {
  hisob: XodimOylikHisobi;
  boshlangichBall: number;
}) {
  const { year, monthIndex0 } = parseMonthString(hisob.oy);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">
          Oyligim · {formatMonthLabel(year, monthIndex0)}
        </h2>
        <BallBelgi holat={hisob.ballHolati} />
      </div>

      <div>
        <p className="text-2xs text-muted uppercase tracking-wide">Sotuvim</p>
        <Money value={hisob.sotuv} size="xl" tone="income" />
        <div className="mt-3">
          <PlanChizigi sotuv={hisob.sotuv} plan={hisob.plan} foiz={hisob.planFoizi} compact />
        </div>
      </div>

      {hisob.vazifalar.length > 0 && (
        <div>
          <BallChizigi ball={hisob.ortachaBall} boshlangich={boshlangichBall} compact />
          <ul className="mt-2 space-y-1">
            {hisob.vazifalar.map((v) => (
              <li key={v.taskId} className="flex items-baseline justify-between gap-2 text-2xs">
                <span className="text-muted truncate">{v.nomi}</span>
                <span className="shrink-0 tnum text-fg">
                  {v.ball} ball · {foizMatn(v.foiz)} · {qisqaSumma(v.hisoblangan)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="space-y-1.5 text-2xs border-t border-line pt-3">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Vazifa haqi</dt>
          <dd className="text-fg tnum">{hisob.vazifaHaqi.toLocaleString("uz-UZ")}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Sotuv bonusi</dt>
          <dd className="text-fg tnum">{hisob.sotuvBonusi.toLocaleString("uz-UZ")}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Plan bonusi</dt>
          <dd className="text-fg tnum">{hisob.planBonusi.toLocaleString("uz-UZ")}</dd>
        </div>
      </dl>

      <div className="border-t border-line pt-3">
        <p className="text-2xs text-muted uppercase tracking-wide">
          {hisob.yakuniy ? "Yakuniy oylik" : "Hozirgi hisob"}
        </p>
        <Money value={hisob.jami} size="display" tone="brand" />
      </div>

      <Link
        href={`/app/hr/kpi/${hisob.employeeId}`}
        className="block text-2xs text-brand hover:underline"
      >
        Batafsil: ball tarixi va sotuvlarim
      </Link>
    </section>
  );
}
