"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { CashFlowChart, type OqimChizma } from "@/components/charts/CashFlowChart";
import { CHART_COLORS } from "@/components/charts/ChartKit";
import { formatDateUz, formatMoneyCompact, formatMonthLabel, uzOyNomi } from "@/lib/format";
import { dateOnlyStringToUTCDate, parseMonthString } from "@/lib/date";
import type { PulOqimi } from "@/lib/queries/dashboardPanel";

type Oraliq = "7k" | "30k" | "3oy" | "1yil";

const ORALIQLAR: { value: Oraliq; label: string }[] = [
  { value: "7k", label: "7 kun" },
  { value: "30k", label: "30 kun" },
  { value: "3oy", label: "3 oy" },
  { value: "1yil", label: "1 yil" },
];

/** Kunlik seriyadan oxirgi N kun olinadi. */
const KUN_SONI: Record<"7k" | "30k" | "3oy", number> = { "7k": 7, "30k": 30, "3oy": 92 };

/**
 * "PUL OQIMI" BLOKI — kirim, chiqim va sof natija vaqt bo'yicha.
 *
 * TO'RTALA FILTR BITTA MA'LUMOT TO'PLAMIDAN kesiladi: server 92 kunlik va
 * 12 oylik seriyani bir marta beradi (`getPulOqimi`), filtr almashtirilganda
 * yangi so'rov KETMAYDI. Shu bois bu blok uchun alohida API route ham yo'q.
 *
 * Yangi grafik kutubxonasi qo'shilmadi — mavjud `recharts` ishlatiladi.
 */
export function PulOqimiBloki({ oqim, boshlangich = "30k" }: { oqim: PulOqimi; boshlangich?: Oraliq }) {
  const [oraliq, setOraliq] = useState<Oraliq>(boshlangich);

  const data: OqimChizma[] = useMemo(() => {
    if (oraliq === "1yil") {
      return oqim.oylik.map((n) => {
        const { year, monthIndex0 } = parseMonthString(n.kalit);
        return { ...n, yorliq: uzOyNomi(monthIndex0).slice(0, 3), sarlavha: formatMonthLabel(year, monthIndex0) };
      });
    }
    const kunlar = KUN_SONI[oraliq];
    return oqim.kunlik.slice(-kunlar).map((n) => {
      const sana = dateOnlyStringToUTCDate(n.kalit);
      return {
        ...n,
        // 7 kunlik ko'rinishda kun+oy sig'adi, uzunroq davrda faqat kun raqami.
        yorliq: oraliq === "7k" ? formatDateUz(sana) : n.kalit.slice(-2),
        sarlavha: formatDateUz(sana),
      };
    });
  }, [oqim, oraliq]);

  const jami = useMemo(
    () =>
      data.reduce(
        (a, d) => ({ kirim: a.kirim + d.kirim, chiqim: a.chiqim + d.chiqim }),
        { kirim: 0, chiqim: 0 }
      ),
    [data]
  );
  const sof = jami.kirim - jami.chiqim;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-fg">Pul oqimi</h2>
          {/* Tanlangan davr yakuni sarlavha ostida — grafikni o'qimasdan
              ham "qancha kirdi, qancha chiqdi" ko'rinadi. */}
          <p className="text-2xs text-muted mt-1 tnum">
            Kirim {formatMoneyCompact(jami.kirim)} · Chiqim {formatMoneyCompact(jami.chiqim)} ·{" "}
            <span className={sof >= 0 ? "text-income font-medium" : "text-expense font-medium"}>
              Sof {formatMoneyCompact(sof)}
            </span>
          </p>
        </div>
        {/* Telefonda segment tanlov butun kenglikni oladi — 4 ta variant
            siqilib o'qilmay qolmasin. */}
        <Segmented
          options={ORALIQLAR}
          value={oraliq}
          onChange={setOraliq}
          className="w-full sm:w-auto justify-between"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-2">
        {[
          { label: "Kirim", color: CHART_COLORS.income },
          { label: "Chiqim", color: CHART_COLORS.expense },
          { label: "Sof natija", color: CHART_COLORS.ink },
        ].map((it) => (
          <span key={it.label} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: it.color }} />
            {it.label}
          </span>
        ))}
      </div>

      <CashFlowChart data={data} />
    </Card>
  );
}
