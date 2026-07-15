"use client";

import { useRouter, usePathname } from "next/navigation";
import { shiftMonthString, parseMonthString } from "@/lib/date";
import { formatMonthLabel } from "@/lib/format";

export function MonthSelector({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function goTo(newMonth: string) {
    router.push(`${pathname}?month=${newMonth}`);
  }

  const { year, monthIndex0 } = parseMonthString(month);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => goTo(shiftMonthString(month, -1))}
        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
      >
        ‹
      </button>
      <span className="font-medium text-slate-700 min-w-[140px] text-center">
        {formatMonthLabel(year, monthIndex0)}
      </span>
      <button
        onClick={() => goTo(shiftMonthString(month, 1))}
        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
      >
        ›
      </button>
    </div>
  );
}
