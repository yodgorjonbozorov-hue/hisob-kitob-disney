"use client";

import { Badge } from "@/components/ui/Badge";
import { formatDateUZ } from "@/lib/format";
import { AmalMenu, type MenuAmali } from "./AmalMenu";
import { biznesMatni, type XodimDTO } from "./turlar";

/**
 * XODIMLAR RO'YXATI — desktopda jadval, telefonda kartochka.
 *
 * Nega umumiy `Jadval` komponenti EMAS: bu ro'yxatda qatorning O'ZI bosiladi
 * (tafsilot ochiladi) va amallar bitta "•••" menyusiga yig'ilgan. `Jadval`
 * esa amallarni yonma-yon tugmalar qilib chiqaradi — aynan biz olib
 * tashlamoqchi bo'lgan ko'rinish.
 *
 * MOBILDA JADVAL YO'Q: 375px ekranda 7 ustunli jadval gorizontal siljish
 * demak, ya'ni "Holati" va "Amal" ekrandan tashqarida qoladi.
 */

/** Holat nishoni — rangdan tashqari MATN ham bor (rang ko'rmaydiganlar uchun). */
function HolatBadge({ faol }: { faol: boolean }) {
  return (
    <Badge tone={faol ? "kirim" : "neutral"}>
      <span aria-hidden>{faol ? "🟢" : "⚪"}</span> {faol ? "Faol" : "Nofaol"}
    </Badge>
  );
}

export function XodimlarRoyxat({
  xodimlar,
  onOch,
  amallar,
}: {
  xodimlar: XodimDTO[];
  /** Qator/kartochka bosilganda tafsilot oynasi ochiladi. */
  onOch: (x: XodimDTO) => void;
  amallar: (x: XodimDTO) => MenuAmali[];
}) {
  return (
    <>
      {/* ── Desktop (≥1024px): jadval ──────────────────────────────── */}
      <div className="hidden lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-xs uppercase border-b border-line">
              <th scope="col" className="pb-2 pr-4 font-medium">Xodim</th>
              <th scope="col" className="pb-2 pr-4 font-medium">Login</th>
              <th scope="col" className="pb-2 pr-4 font-medium">Rol</th>
              <th scope="col" className="pb-2 pr-4 font-medium">Biznes</th>
              <th scope="col" className="pb-2 pr-4 font-medium">Holati</th>
              <th scope="col" className="pb-2 pr-4 font-medium whitespace-nowrap">Qo&apos;shilgan</th>
              <th scope="col" className="pb-2 font-medium text-right">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {xodimlar.map((x) => (
              <tr
                key={x.id}
                onClick={() => onOch(x)}
                className="hover:bg-surface-2/50 transition cursor-pointer"
              >
                <td className="py-2.5 pr-4 font-medium text-fg">{x.ism}</td>
                <td className="py-2.5 pr-4 text-muted">{x.login}</td>
                {/* Rol JADVALDA faqat matn — bu yerdagi tanlagich bir bosishda
                    ruxsatni o'zgartirib yuborardi (tasodifan ham). */}
                <td className="py-2.5 pr-4">{x.rolNomi}</td>
                <td className="py-2.5 pr-4 text-muted">{biznesMatni(x)}</td>
                <td className="py-2.5 pr-4"><HolatBadge faol={x.isActive} /></td>
                <td className="py-2.5 pr-4 text-muted whitespace-nowrap">
                  {formatDateUZ(new Date(x.createdAt))}
                </td>
                <td className="py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <AmalMenu label={x.ism} amallar={amallar(x)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobil/planshet (<1024px): kartochkalar ─────────────────── */}
      <ul className="lg:hidden space-y-2.5 list-none">
        {xodimlar.map((x) => (
          <li key={x.id} className="rounded-xl border border-line bg-surface-2/40">
            <div className="flex items-start gap-2 p-3.5">
              <button
                type="button"
                onClick={() => onOch(x)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-fg text-base leading-snug break-words">
                    {x.ism}
                  </span>
                  <HolatBadge faol={x.isActive} />
                </div>
                <p className="text-sm text-fg mt-1">{x.rolNomi}</p>
                <p className="text-sm text-muted break-words">{biznesMatni(x)}</p>
                <p className="text-2xs text-faint mt-1 break-all">Login: {x.login}</p>
                <p className="text-2xs text-faint">{formatDateUZ(new Date(x.createdAt))}</p>
              </button>
              <AmalMenu label={x.ism} amallar={amallar(x)} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
