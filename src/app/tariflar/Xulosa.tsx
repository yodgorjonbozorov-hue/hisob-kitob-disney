"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { pricingConfig, somFormat, type NarxNatija } from "@/lib/pricing/config";
import type { BiznesProfil } from "@/lib/pricing/profil";
import { signupHavola, type KalkulyatorHolat } from "./TariflarClient";

const KAFOLATLAR = [
  "Bank kartasi kerak emas",
  "Avtomatik pul yechilmaydi",
  "1 daqiqada boshlash",
  "Istalgan vaqtda bekor qilish",
];

/** Desktop: o'ngda yopishqoq (sticky) xulosa kartasi. */
export function Xulosa({
  holat,
  profil,
  narx,
}: {
  holat: KalkulyatorHolat;
  profil: BiznesProfil | null;
  narx: NarxNatija;
}) {
  return (
    <aside className="mt-4 lg:sticky lg:top-20 lg:mt-0">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h3 className="font-heading text-base font-semibold text-fg">Sizning Balansa</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {profil && <Qator matn={profil.label} />}
          <Qator
            matn={`${holat.filiallar}${holat.filiallar >= pricingConfig.maxBranches ? "+" : ""} filial`}
          />
          <Qator matn="Balansa asosiy tizimi" />
          {holat.addons.map((k) => (
            <Qator key={k} matn={pricingConfig.addons[k].nomi} />
          ))}
        </ul>
        <div className="mt-4 border-t border-dashed border-line pt-4">
          {holat.davr === "oylik" ? (
            <>
              <p className="text-xs text-muted">Oylik to'lasangiz</p>
              <p className="font-display text-xl font-bold tabular-nums text-fg">
                {somFormat(narx.oylikJami)} <span className="text-sm font-medium text-muted">so'm / oy</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted">Yillik to'lov</p>
              <p className="font-display text-xl font-bold tabular-nums text-fg">
                {somFormat(narx.yillikJami)} <span className="text-sm font-medium text-muted">so'm / yil</span>
              </p>
              <p className="mt-1 text-xs font-medium text-income">
                {somFormat(narx.yillikTejov)} so'm tejaysiz
              </p>
            </>
          )}
        </div>
        <Link
          href={signupHavola(holat)}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-lg bg-brand px-4 text-base font-semibold text-brand-fg shadow-sm transition-[filter] hover:brightness-110"
        >
          {pricingConfig.trialDays} kun bepul boshlash
        </Link>
        <ul className="mt-4 space-y-1.5">
          {KAFOLATLAR.map((k) => (
            <li key={k} className="flex items-center gap-2 text-xs text-muted">
              <Check size={14} className="shrink-0 text-income" aria-hidden />
              {k}
            </li>
          ))}
        </ul>
        <Link
          href="/#imkoniyatlar"
          className="mt-3 block text-center text-xs font-medium text-muted hover:text-fg"
        >
          Avval imkoniyatlar bilan tanishish →
        </Link>
      </div>
    </aside>
  );
}

function Qator({ matn }: { matn: string }) {
  return (
    <li className="flex items-center gap-2">
      <Check size={15} className="shrink-0 text-brand" aria-hidden />
      {matn}
    </li>
  );
}

/** Mobil: pastga yopishgan yengil narx paneli + CTA (faqat kichik ekranda). */
export function MobilXulosa({ holat, narx }: { holat: KalkulyatorHolat; narx: NarxNatija }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3 pb-safe backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold tabular-nums text-fg">
            {somFormat(holat.davr === "yillik" ? narx.yillikJami : narx.oylikJami)}
            <span className="ml-1 text-xs font-medium text-muted">
              so'm / {holat.davr === "yillik" ? "yil" : "oy"}
            </span>
          </p>
          {holat.davr === "yillik" && (
            <p className="text-2xs text-income">{somFormat(narx.yillikTejov)} so'm tejaysiz</p>
          )}
        </div>
        <Link
          href={signupHavola(holat)}
          className="flex min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-fg"
        >
          {pricingConfig.trialDays} kun bepul
        </Link>
      </div>
    </div>
  );
}
