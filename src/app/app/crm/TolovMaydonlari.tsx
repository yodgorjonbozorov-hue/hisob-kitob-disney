"use client";

import { Select } from "@/components/ui/Select";
import { formatMoney } from "@/lib/format";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/** To'lov tanlovi — `tolangan` summani BELGILAYDI (6-talab). */
export type TolovTanlov = "toliq" | "qisman" | "qarz";

/** Pul kanali — kirim tranzaksiyasiga o'sha ko'rinishda uzatiladi. */
export type PulKanali = "naqd" | "click";

/**
 * TANLOVDAN TO'LANGAN SUMMA: to'liq — butun narx, qarzga — 0, qisman —
 * kiritilgan raqam. To'lov holati (to'liq/qisman/qarz) serverda ham AYNI
 * ikkovidan — narx va to'langan — hisoblanadi, ya'ni formadagi tanlov
 * ikkinchi haqiqat manbaiga aylanmaydi.
 */
export function tolanganHisobla(tanlov: TolovTanlov, narx: number, qismanSumma: number): number {
  if (tanlov === "toliq") return narx;
  if (tanlov === "qarz") return 0;
  return qismanSumma;
}

/**
 * TO'LOV MAYDONLARI: to'lov turi, qisman summa, pul kanali va pul qayerga
 * tushishining oldindan ko'rinishi (5-talab).
 */
export function TolovMaydonlari({
  tanlov,
  onTanlov,
  qisman,
  onQisman,
  kanal,
  onKanal,
  narx,
  tolangan,
}: {
  tanlov: TolovTanlov;
  onTanlov: (v: TolovTanlov) => void;
  /** Qisman to'lov summasi (xom matn — foydalanuvchi kiritgani). */
  qisman: string;
  onQisman: (v: string) => void;
  kanal: PulKanali;
  onKanal: (v: PulKanali) => void;
  narx: number;
  /** Hisoblangan to'langan summa. */
  tolangan: number;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="block text-xs text-muted" htmlFor="bm-tolov">To&apos;lov turi</label>
          <Select
            id="bm-tolov"
            value={tanlov}
            onChange={(v) => onTanlov(v as TolovTanlov)}
            options={[
              { value: "toliq", label: "To'liq to'langan" },
              { value: "qisman", label: "Qisman to'langan" },
              { value: "qarz", label: "Qarzga" },
            ]}
          />
        </div>
        {tanlov === "qisman" && (
          <label className="block space-y-1">
            <span className="text-xs text-muted">To&apos;langan summa (so&apos;m)</span>
            <input
              value={qisman}
              onChange={(e) => onQisman(e.target.value)}
              placeholder="200000"
              inputMode="numeric"
              className={INPUT}
            />
          </label>
        )}
        {tanlov !== "qarz" && (
          <div className="space-y-1">
            <label className="block text-xs text-muted" htmlFor="bm-kanal">Pul kanali</label>
            <Select
              id="bm-kanal"
              value={kanal}
              onChange={(v) => onKanal(v as PulKanali)}
              options={[
                { value: "naqd", label: "Naqd" },
                { value: "click", label: "Click / karta" },
              ]}
            />
          </div>
        )}
      </div>

      {narx > 0 && (
        <p className="text-2xs text-faint tnum">
          Yutildi bosilganda: Kirim {formatMoney(Math.min(tolangan, narx))} · Qarzdorlik{" "}
          {formatMoney(Math.max(0, narx - tolangan))}
        </p>
      )}
    </>
  );
}
