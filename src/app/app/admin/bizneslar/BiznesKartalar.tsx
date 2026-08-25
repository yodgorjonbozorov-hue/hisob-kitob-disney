"use client";

import Link from "next/link";
import { AmalMenyu } from "@/components/ui/AmalMenyu";
import { ModulChiplar } from "./ModulChiplar";
import { biznesAmallari, biznesHavolasi } from "./biznesAmallari";
import { faollikMatn, son, type BusinessDTO } from "./turlar";

/**
 * MOBIL RO'YXAT (<1024px) — KARTOCHKALAR.
 *
 * Jadval telefonga ataylab SIQILMAYDI: 375px ekranda 7 ustun gorizontal
 * siljishga aylanadi va foydalanuvchi qayerdaligini yo'qotadi. Har biznes
 * o'z kartochkasida: nomi + holati, raqamlar, modullar, oxirgi faollik va
 * ikkita bosish nishoni (44px).
 */
export function BiznesKartalar({
  bizneslar,
  owner,
  onHolat,
}: {
  bizneslar: BusinessDTO[];
  owner: boolean;
  onHolat: (b: BusinessDTO) => void;
}) {
  return (
    <ul className="lg:hidden space-y-3 list-none">
      {bizneslar.map((b) => (
        <li key={b.id} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <Link href={biznesHavolasi(b.id)} className="min-w-0 flex-1">
              <p className="font-semibold text-fg leading-snug break-words">{b.nomi}</p>
            </Link>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 text-2xs font-medium ${
                b.isActive ? "text-income" : "text-faint"
              }`}
            >
              <span
                aria-hidden
                className={`w-2 h-2 rounded-full ${b.isActive ? "bg-income" : "bg-line"}`}
              />
              {b.isActive ? "Faol" : "Nofaol"}
            </span>
          </div>

          <p className="mt-2 text-sm text-muted tnum">
            {son(b.tranzaksiyalar)} tranzaksiya · {son(b.xodimlar)} xodim
          </p>

          <div className="mt-2">
            <ModulChiplar modullar={b.modullar} maks={5} />
          </div>

          <p className="mt-2 text-2xs text-faint">
            Oxirgi faollik: <span className="text-muted">{faollikMatn(b.oxirgiFaollik)}</span>
          </p>

          <div className="mt-3 pt-3 border-t border-line flex items-center gap-2">
            <Link
              href={biznesHavolasi(b.id)}
              className="flex-1 inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl bg-brand-wash text-brand text-sm font-medium active:scale-[0.99] transition"
            >
              Biznesni ochish
            </Link>
            <AmalMenyu
              amallar={biznesAmallari(b, { owner, onHolat: () => onHolat(b) })}
              label={`${b.nomi} — boshqa amallar`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
