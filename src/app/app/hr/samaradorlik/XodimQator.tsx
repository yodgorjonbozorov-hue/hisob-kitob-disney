"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatSom } from "@/lib/format";
import type { KategoriyaXodimStatDTO } from "@/lib/queries/kategoriyaAnalitika";
import { XodimAvatar } from "../XodimAvatar";
import { PlanProgress } from "../PlanProgress";

/** Reyting medallari — dastlabki uch o'rin. */
const MEDALLAR = ["🥇", "🥈", "🥉"];

/**
 * SOTUVCHI KESIMI (11-talab): olingan, bugungi, jarayonda, yutilgan,
 * yo'qotilgan — har biri "nechta / summa" ko'rinishida.
 *
 * Bu kesim CRM doskasi bilan AYNI qoidadan chiqadi (`lib/crm/pipeline.ts`):
 * "bugungi" va "jarayonda" bazada saqlanmaydi, ular zakaz holati va
 * sanasidan hisoblanadi. Shuning uchun bu yerdagi raqamlar doskadagi
 * ustun sarlavhalari bilan mos keladi.
 */
function Kesim({ nomi, soni, summa }: { nomi: string; soni: number; summa: number }) {
  return (
    <span className="block">
      <span className="block text-2xs text-faint">{nomi}</span>
      <span className="block text-xs font-medium text-fg tnum">
        {soni} ta{summa > 0 ? ` · ${formatSom(summa)}` : ""}
      </span>
    </span>
  );
}

export function XodimQator({
  x,
  sotuvchimi,
  havolaQuery,
}: {
  x: KategoriyaXodimStatDTO;
  sotuvchimi: boolean;
  havolaQuery: string;
}) {
  return (
    <li>
      <Link
        href={`/app/hr/samaradorlik/${x.employeeId}${havolaQuery}`}
        className="flex items-center gap-3 px-4 py-3 min-h-[64px] hover:bg-surface-2 transition"
      >
        <span className="w-7 text-center text-sm shrink-0" aria-label={`${x.orin}-o'rin`}>
          {MEDALLAR[x.orin - 1] ?? <span className="text-faint tnum">{x.orin}</span>}
        </span>
        <XodimAvatar ism={x.ism} rasmUrl={x.rasmUrl} size="sm" />
        <span className="flex-1 min-w-0 space-y-1">
          <span className="block font-medium text-fg truncate">
            {x.ism}
            {!x.isActive && <span className="text-2xs text-faint"> · nofaol</span>}
            {!x.azo && <span className="text-2xs text-faint"> · a&apos;zolikdan chiqqan</span>}
          </span>

          <span className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-1">
            <Kesim nomi="Olingan" soni={x.jami} summa={x.jamiSumma} />
            <Kesim nomi="Bugungi" soni={x.bugungi} summa={x.bugungiSumma} />
            <Kesim nomi="Jarayonda" soni={x.jarayonda} summa={x.jarayondaSumma} />
            <Kesim nomi={sotuvchimi ? "Yutildi" : "Bajarildi"} soni={x.yutilgan} summa={x.summa} />
            <Kesim nomi="Yo'qotildi" soni={x.yutqazilgan} summa={x.yutqazilganSumma} />
          </span>

          <span className="block text-2xs text-muted tnum">
            Konversiya: {x.konversiya}%
            {sotuvchimi ? ` · To'liq puli kelgan sotuv: ${formatSom(x.tolanganSotuv)} so'm` : ""}
          </span>

          {x.plan && (
            <span className="block mt-1 max-w-xs">
              <PlanProgress plan={x.plan} compact />
            </span>
          )}
        </span>
        {sotuvchimi ? (
          <span className="text-right shrink-0">
            <span className="block font-display tnum font-semibold text-fg">{formatSom(x.summa)}</span>
            <span className="block text-xs text-muted">so&apos;m sotuv</span>
          </span>
        ) : (
          <span className="text-right shrink-0">
            <span className="block font-display tnum font-semibold text-fg">{x.yutilgan}</span>
            <span className="block text-xs text-muted">bajarilgan</span>
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-faint shrink-0" aria-hidden="true" />
      </Link>
    </li>
  );
}
