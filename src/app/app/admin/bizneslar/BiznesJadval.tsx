"use client";

import Link from "next/link";
import { AmalMenyu } from "@/components/ui/AmalMenyu";
import { Badge } from "@/components/ui/Badge";
import { ModulChiplar } from "./ModulChiplar";
import { biznesAmallari, biznesHavolasi } from "./biznesAmallari";
import { faollikMatn, son, type BusinessDTO } from "./turlar";

/**
 * DESKTOP RO'YXAT (≥1024px).
 *
 * Ustunlar ataylab kam: biznes, holati, modullar, xodimlar, tranzaksiyalar,
 * oxirgi faollik. Kategoriya soni bu yerdan OLIB TASHLANDI — u kundalik
 * qarorga ta'sir qilmaydi va tafsilot sahifasida ko'rinadi.
 *
 * Mobil ko'rinish bu jadvalni siqmaydi — u alohida kartochka ro'yxati
 * (BiznesKartalar.tsx), shuning uchun bu yerda gorizontal siljish YO'Q.
 */
export function BiznesJadval({
  bizneslar,
  owner,
  onHolat,
}: {
  bizneslar: BusinessDTO[];
  owner: boolean;
  onHolat: (b: BusinessDTO) => void;
}) {
  return (
    <div className="hidden lg:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-faint text-2xs uppercase tracking-wide border-b border-line">
            <th scope="col" className="pb-2.5 pr-4 font-medium">Biznes</th>
            <th scope="col" className="pb-2.5 pr-4 font-medium">Holati</th>
            <th scope="col" className="pb-2.5 pr-4 font-medium">Modullar</th>
            <th scope="col" className="pb-2.5 pr-4 font-medium text-right">Xodimlar</th>
            <th scope="col" className="pb-2.5 pr-4 font-medium text-right">Tranzaksiyalar</th>
            <th scope="col" className="pb-2.5 pr-4 font-medium">Oxirgi faollik</th>
            <th scope="col" className="pb-2.5 font-medium text-right">Amal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {bizneslar.map((b) => (
            <tr key={b.id} className="hover:bg-surface-2/50 transition">
              <td className="py-3 pr-4">
                <Link
                  href={biznesHavolasi(b.id)}
                  className="font-medium text-fg hover:text-brand transition break-words"
                >
                  {b.nomi}
                </Link>
              </td>
              <td className="py-3 pr-4">
                <Badge tone={b.isActive ? "kirim" : "neutral"}>{b.isActive ? "Faol" : "Nofaol"}</Badge>
              </td>
              <td className="py-3 pr-4 max-w-[16rem]">
                {/* Bitta qator: chiplar qatorni balandlatib yubormasin —
                    to'liq ro'yxat chipning `title` idan va tafsilot
                    sahifasidan ko'rinadi. */}
                <span className="block truncate">
                  <ModulChiplar modullar={b.modullar} maks={3} />
                </span>
              </td>
              <td className="py-3 pr-4 text-right tnum text-muted">{son(b.xodimlar)}</td>
              <td className="py-3 pr-4 text-right tnum text-muted">{son(b.tranzaksiyalar)}</td>
              <td className="py-3 pr-4 text-muted whitespace-nowrap">{faollikMatn(b.oxirgiFaollik)}</td>
              <td className="py-3">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={biznesHavolasi(b.id)}
                    className="inline-flex items-center h-9 px-3 rounded-xl border border-line text-xs font-medium text-fg hover:border-brand hover:text-brand transition"
                  >
                    Ochish
                  </Link>
                  <AmalMenyu
                    amallar={biznesAmallari(b, { owner, onHolat: () => onHolat(b) })}
                    label={`${b.nomi} — boshqa amallar`}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
