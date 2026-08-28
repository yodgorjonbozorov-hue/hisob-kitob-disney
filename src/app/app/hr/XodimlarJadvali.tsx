"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { STAVKA_NOMI, type StavkaTuri } from "@/lib/validation/hr";
import type { XodimDTO } from "@/lib/queries/hr";

/** Xodimlar ro'yxati jadvali (HrClient'dan ajratilgan — 250 satr qoidasi). */
export function XodimlarJadvali({
  xodimlar,
  onTahrir,
  onYangi,
}: {
  xodimlar: XodimDTO[];
  onTahrir: (x: XodimDTO) => void;
  onYangi: () => void;
}) {
  if (xodimlar.length === 0) {
    return (
      <EmptyState
        icon="👷"
        title="Hali xodim yo'q"
        description="Xodim kartochkasi tizim hisobidan alohida: tizimga kirmaydigan xodimlarga ham oylik yuritiladi."
        action={<Button onClick={onYangi}>Birinchi xodim</Button>}
      />
    );
  }
  return (
    <div className="jadval-siljish">
      <table className="w-full text-sm min-w-[32rem]">
        <thead>
          <tr className="text-left text-faint text-xs uppercase">
            <th className="pb-2">Ism</th>
            <th className="pb-2">Lavozim</th>
            <th className="pb-2">Telefon</th>
            <th className="pb-2 text-right">Stavka</th>
            <th className="pb-2 text-right">Amallar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {xodimlar.map((x) => (
            <tr key={x.id} className={x.isActive ? "" : "opacity-50"}>
              <td className="py-2.5 font-medium">
                {x.ism}
                {!x.isActive && <span className="block text-2xs text-faint">Ishlamaydi</span>}
              </td>
              <td className="py-2.5">{x.lavozim ?? "—"}</td>
              <td className="py-2.5">{x.tel ?? "—"}</td>
              <td className="py-2.5 text-right tnum">
                {x.stavka.toLocaleString("uz-UZ")}
                <span className="block text-2xs text-faint">
                  {STAVKA_NOMI[x.stavkaTuri as StavkaTuri] ?? x.stavkaTuri}
                </span>
              </td>
              <td className="py-2.5 text-right">
                <div className="flex gap-3 justify-end">
                  <a href={`/app/hr/xodim/${x.id}`} className="text-2xs text-brand hover:underline">
                    Davomat
                  </a>
                  <button
                    type="button"
                    onClick={() => onTahrir(x)}
                    className="text-2xs text-brand hover:underline"
                  >
                    Tahrirlash
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
