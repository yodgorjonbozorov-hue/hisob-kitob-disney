"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import type { Kategoriya } from "./turlar";

/**
 * KATEGORIYA RO'YXATI — bitta ma'lumotdan ikki ko'rinish.
 *
 *  · ≥1024px — zich jadval (Nomi / Holati / Ishlatilgan / Davr summasi);
 *  · <1024px — ixcham kartochka: nom + bitta qatorli xulosa.
 *
 * Gorizontal siljish YO'Q: telefonda jadvalni siqib sig'dirishga urinish
 * o'rniga ustunlar bitta qatorga jamlanadi (`Jadval` komponentidagi bilan
 * bir xil yondashuv, lekin bu yerda BUTUN QATOR bosiladi — tafsilot varag'i
 * ochiladi, ya'ni har qatorda alohida amal tugmalari kerak emas).
 */
export function KategoriyaRoyxat({
  qatorlar,
  oyNomi,
  onTanla,
}: {
  qatorlar: Kategoriya[];
  oyNomi: string;
  onTanla: (k: Kategoriya) => void;
}) {
  return (
    <>
      {/* ── Desktop ───────────────────────────────────────────────── */}
      <table className="hidden lg:table w-full text-sm">
        <thead>
          <tr className="text-left text-faint text-xs uppercase border-b border-line">
            <th scope="col" className="pb-2 pr-4 font-medium">Nomi</th>
            <th scope="col" className="pb-2 pr-4 font-medium">Holati</th>
            <th scope="col" className="pb-2 pr-4 font-medium text-right">Ishlatilgan</th>
            <th scope="col" className="pb-2 pr-4 font-medium text-right">{oyNomi}</th>
            <th scope="col" className="pb-2 font-medium text-right">Amal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {qatorlar.map((k) => (
            <tr key={k.id} className="hover:bg-surface-2/50 transition">
              <td className="py-2.5 pr-4 align-middle">
                <NomKatak k={k} />
              </td>
              <td className="py-2.5 pr-4 align-middle">
                <HolatBadge faol={k.isActive} />
              </td>
              <td className="py-2.5 pr-4 align-middle text-right tnum">
                <YozuvSoni k={k} />
              </td>
              <td className="py-2.5 pr-4 align-middle text-right tnum text-muted">
                {k.davrSummasi > 0 ? formatMoney(k.davrSummasi) : "—"}
              </td>
              <td className="py-2.5 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onTanla(k)}
                  className="text-xs font-medium text-muted hover:text-brand"
                >
                  Boshqarish
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Mobil/planshet ────────────────────────────────────────── */}
      <ul className="lg:hidden space-y-2 list-none">
        {qatorlar.map((k) => (
          <li key={k.id}>
            <button
              type="button"
              onClick={() => onTanla(k)}
              className="w-full text-left rounded-xl border border-line bg-surface px-3.5 py-3 min-h-[64px] flex items-center gap-3 active:scale-[0.99] transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-fg break-words">{k.nomi}</span>
                  {k.tizim && <Badge tone="info">Tizim</Badge>}
                </div>
                <p className="text-2xs text-muted mt-1 tnum">
                  {k.isActive ? "Faol" : "Nofaol"} · {k.yozuvSoni} ta yozuv
                  {k.davrSummasi > 0 && ` · ${formatMoneyCompact(k.davrSummasi)}`}
                </p>
              </div>
              <span aria-hidden="true" className="text-faint shrink-0">›</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function NomKatak({ k }: { k: Kategoriya }) {
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="font-medium text-fg">{k.nomi}</span>
      {k.tizim && <Badge tone="info">Tizim</Badge>}
      {k.kgAsosli && <Badge tone="neutral">Kg</Badge>}
    </span>
  );
}

function HolatBadge({ faol }: { faol: boolean }) {
  return <Badge tone={faol ? "kirim" : "neutral"}>{faol ? "Faol" : "Nofaol"}</Badge>;
}

/**
 * Yozuvlar soni — tranzaksiyalar ro'yxatiga SHU kategoriya filtri bilan
 * havola. Filtr mavjud sahifada allaqachon bor (`?categoryId=`), shuning
 * uchun yangi ekran qurilmadi.
 */
function YozuvSoni({ k }: { k: Kategoriya }) {
  if (k.yozuvSoni === 0) return <span className="text-faint">0</span>;
  return (
    <Link
      href={`/app/tranzaksiyalar?categoryId=${k.id}&turi=${k.turi}`}
      className="text-muted hover:text-brand underline decoration-dotted underline-offset-2"
    >
      {k.yozuvSoni} ta yozuv
    </Link>
  );
}
