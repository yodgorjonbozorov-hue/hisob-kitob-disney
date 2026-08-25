import Link from "next/link";
import { DAVRLAR, type Davr } from "@/lib/queries/davriyHisobot";

/**
 * HISOBOT DAVRI TABLARI — Kunlik / Haftalik / Oylik / Yillik.
 *
 * Ilgari yon menyuda "Oylik hisobot" alohida havola edi va boshqa davrlar
 * umuman yo'q edi. Endi hammasi bitta sahifada: tab oddiy havola (URL'da
 * `?davr=`), shuning uchun holat saqlanadi, orqaga tugmasi ishlaydi va
 * hisobotni havola bilan ulashish mumkin.
 */
export function DavrTablari({ joriy, month }: { joriy: Davr; month: string }) {
  return (
    <div
      role="tablist"
      aria-label="Hisobot davri"
      className="flex gap-1 p-1 rounded-xl bg-surface-2 overflow-x-auto"
    >
      {DAVRLAR.map((d) => {
        const active = d.kod === joriy;
        return (
          <Link
            key={d.kod}
            href={`/app/hisobot?davr=${d.kod}&month=${month}`}
            role="tab"
            aria-selected={active}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg"
            }`}
          >
            {d.yorliq}
          </Link>
        );
      })}
    </div>
  );
}
