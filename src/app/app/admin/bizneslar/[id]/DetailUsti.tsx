"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AmalMenyu, type MenyuAmali } from "@/components/ui/AmalMenyu";
import { Button } from "@/components/ui/Button";
import { faollikMatn, son } from "../turlar";
import type { BiznesTafsilot } from "@/lib/services/biznesTafsilot";

/** Tafsilot sarlavhasi + ko'rsatkichlar. Barcha raqamlar bazadan. */
export function DetailUsti({
  biznes,
  modulSoni,
  otishBand,
  amallar,
  onOtish,
}: {
  biznes: BiznesTafsilot;
  modulSoni: number;
  otishBand: boolean;
  amallar: MenyuAmali[];
  onOtish: () => void;
}) {
  const kartalar = [
    { nomi: "Xodimlar", qiymat: son(biznes.xodimlar.length) },
    { nomi: "Kategoriyalar", qiymat: son(biznes.kategoriyalar) },
    { nomi: "Tranzaksiyalar", qiymat: son(biznes.tranzaksiyalar) },
    { nomi: "Modullar", qiymat: son(modulSoni) },
    { nomi: "Oxirgi faollik", qiymat: faollikMatn(biznes.oxirgiFaollik) },
  ];

  return (
    <div className="space-y-4">
      <Link
        href="/app/admin/bizneslar"
        className="inline-flex items-center gap-1 min-h-[44px] text-sm text-muted hover:text-fg transition"
      >
        <ChevronLeft size={16} aria-hidden />
        Bizneslar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-fg break-words">{biznes.nomi}</h1>
          <p
            className={`mt-1 inline-flex items-center gap-1.5 text-sm ${
              biznes.isActive ? "text-income" : "text-faint"
            }`}
          >
            <span
              aria-hidden
              className={`w-2 h-2 rounded-full ${biznes.isActive ? "bg-income" : "bg-line"}`}
            />
            {biznes.isActive ? "Faol" : "Nofaol"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            onClick={onOtish}
            loading={otishBand}
            disabled={!biznes.isActive}
            className="min-h-[44px]"
            title={biznes.isActive ? undefined : "Nofaol biznesga o'tib bo'lmaydi"}
          >
            Biznesga o&apos;tish
          </Button>
          <AmalMenyu amallar={amallar} label={`${biznes.nomi} — boshqa amallar`} />
        </div>
      </div>

      {/* 5 ta karta 2 ustunga bo'linganda oxirgisi yolg'iz qoladi — u ikkala
          ustunni egallaydi, aks holda yonida bo'sh kulrang katak turadi. */}
      <dl className="grid grid-cols-2 lg:grid-cols-5 gap-px rounded-2xl border border-line bg-line overflow-hidden">
        {kartalar.map((k, i) => (
          <div
            key={k.nomi}
            className={`bg-surface px-4 py-3 ${
              i === kartalar.length - 1 ? "col-span-2 lg:col-span-1" : ""
            }`}
          >
            <dt className="text-2xs text-faint uppercase tracking-wide">{k.nomi}</dt>
            <dd className="text-base font-semibold text-fg tnum mt-0.5 truncate" title={k.qiymat}>
              {k.qiymat}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
