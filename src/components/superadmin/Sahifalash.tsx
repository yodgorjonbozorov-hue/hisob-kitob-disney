"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * SERVER-SIDE SAHIFALASH BOSHQARUVI.
 *
 * Holat URL'da yashaydi (`?sahifa=`) — sahifa yangilansa ham, havola
 * ulashilsa ham bir xil natija ochiladi va orqaga tugmasi to'g'ri ishlaydi.
 */
export function Sahifalash({
  sahifa,
  sahifalar,
  jami,
  limit,
}: {
  sahifa: number;
  sahifalar: number;
  jami: number;
  limit: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function otish(yangi: number) {
    const p = new URLSearchParams(params.toString());
    p.set("sahifa", String(yangi));
    router.push(`${pathname}?${p.toString()}`);
  }

  const boshi = jami === 0 ? 0 : (sahifa - 1) * limit + 1;
  const oxiri = Math.min(sahifa * limit, jami);

  const tugma = "px-3 py-1.5 rounded-lg border border-line text-sm disabled:opacity-40 hover:bg-surface-2 transition";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <p className="text-2xs text-muted tabular-nums">
        {jami === 0 ? "Yozuv yo'q" : `${boshi}–${oxiri} / jami ${jami.toLocaleString("ru-RU")}`}
      </p>
      <div className="flex items-center gap-2">
        <button className={tugma} onClick={() => otish(sahifa - 1)} disabled={sahifa <= 1}>
          Oldingi
        </button>
        <span className={cn("text-2xs text-muted tabular-nums px-1")}>
          {sahifa} / {sahifalar}
        </span>
        <button
          className={tugma}
          onClick={() => otish(sahifa + 1)}
          disabled={sahifa >= sahifalar}
        >
          Keyingi
        </button>
      </div>
    </div>
  );
}
