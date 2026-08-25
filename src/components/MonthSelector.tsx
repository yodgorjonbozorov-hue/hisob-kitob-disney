"use client";

import { useRouter, usePathname } from "next/navigation";
import { shiftMonthString, parseMonthString } from "@/lib/date";
import { formatMonthLabel } from "@/lib/format";

export function MonthSelector({
  month,
  qoshimcha,
}: {
  month: string;
  /**
   * Oy almashtirilganda SAQLANADIGAN qo'shimcha query (masalan "davr=kunlik").
   * Berilmasa avvalgi xatti-harakat: URL'da faqat `month` qoladi.
   */
  qoshimcha?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function goTo(newMonth: string) {
    router.push(`${pathname}?month=${newMonth}${qoshimcha ? `&${qoshimcha}` : ""}`);
  }

  const { year, monthIndex0 } = parseMonthString(month);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => goTo(shiftMonthString(month, -1))}
        className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-line text-muted"
      >
        ‹
      </button>
      <span className="font-medium text-fg min-w-[140px] text-center">
        {formatMonthLabel(year, monthIndex0)}
      </span>
      <button
        onClick={() => goTo(shiftMonthString(month, 1))}
        className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-line text-muted"
      >
        ›
      </button>
    </div>
  );
}
