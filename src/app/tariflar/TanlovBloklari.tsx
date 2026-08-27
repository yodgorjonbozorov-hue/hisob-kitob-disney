"use client";

import {
  Boxes,
  Briefcase,
  Car,
  Check,
  Factory,
  Handshake,
  Sparkles,
  Store,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import {
  ADDON_KEYS,
  pricingConfig,
  somFormat,
  type AddonKey,
  type TolovDavri,
} from "@/lib/pricing/config";
import { BIZNES_PROFILLAR, BUSINESS_TYPES, type BiznesProfil, type BusinessType } from "@/lib/pricing/profil";
import type { KalkulyatorHolat } from "./TariflarClient";

const YONALISH_IKON: Record<BusinessType, LucideIcon> = {
  auto: Car,
  perfume: Sparkles,
  food: Store,
  agro: Wheat,
  service: Handshake,
  wholesale: Boxes,
  manufacturing: Factory,
  other: Briefcase,
};

function Bosqich({ raqam, sarlavha, children }: { raqam: number; sarlavha: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2.5 font-heading text-base font-semibold text-fg">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-wash text-sm font-bold text-brand">
          {raqam}
        </span>
        {sarlavha}
      </h2>
      {children}
    </section>
  );
}

export function TanlovBloklari({
  holat,
  profil,
  onYonalish,
  onFiliallar,
  onAddon,
  onDavr,
}: {
  holat: KalkulyatorHolat;
  profil: BiznesProfil | null;
  onYonalish: (y: BusinessType) => void;
  onFiliallar: (f: number) => void;
  onAddon: (k: AddonKey) => void;
  onDavr: (d: TolovDavri) => void;
}) {
  return (
    <div>
      <Bosqich raqam={1} sarlavha="Biznesingiz qaysi sohada?">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {BUSINESS_TYPES.map((code) => {
            const p = BIZNES_PROFILLAR[code];
            const Ikon = YONALISH_IKON[code];
            const faol = holat.yonalish === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => onYonalish(code)}
                aria-pressed={faol}
                className={`flex min-h-[76px] flex-col items-start justify-center gap-1.5 rounded-xl border p-3 text-left transition-colors ${
                  faol
                    ? "border-brand bg-brand-wash shadow-card"
                    : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                <Ikon size={20} className={faol ? "text-brand" : "text-faint"} aria-hidden />
                <span className="text-xs font-medium text-fg">{p.label}</span>
              </button>
            );
          })}
        </div>
        {/* Yo'nalish narxni O'ZGARTIRMAYDI — faqat tavsiya va moslashtirish. */}
        <p className="mt-3 min-h-[1.25rem] text-xs text-muted">
          {profil
            ? profil.tavsiyaMatni
            : "Yo'nalish narxni o'zgartirmaydi — Balansa faqat sizga moslashadi."}
        </p>
      </Bosqich>

      <Bosqich raqam={2} sarlavha="Nechta filialingiz bor?">
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-xl font-bold tabular-nums text-fg">
              {holat.filiallar}
              {holat.filiallar >= pricingConfig.maxBranches ? "+" : ""}
              <span className="ml-1.5 text-sm font-medium text-muted">filial</span>
            </span>
            <span className="text-xs text-muted">
              {holat.filiallar <= pricingConfig.includedBranches
                ? "Asosiy narxga kiritilgan"
                : `+${somFormat(
                    (holat.filiallar - pricingConfig.includedBranches) *
                      pricingConfig.additionalBranchPrice
                  )} so'm / oy`}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={pricingConfig.maxBranches}
            step={1}
            value={holat.filiallar}
            onChange={(e) => onFiliallar(Number(e.target.value))}
            aria-label="Filiallar soni"
            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-[color:rgb(var(--brand))]"
          />
          <p className="mt-2 text-2xs text-faint">
            Birinchi filial narxga kiritilgan. Har qo'shimcha filial —{" "}
            {somFormat(pricingConfig.additionalBranchPrice)} so'm / oy.
          </p>
        </div>
      </Bosqich>

      <Bosqich raqam={3} sarlavha="Qo'shimcha imkoniyatlar">
        <div className="space-y-2.5">
          {ADDON_KEYS.map((kalit) => {
            const addon = pricingConfig.addons[kalit];
            const tanlangan = holat.addons.includes(kalit);
            const tavsiya = profil?.tavsiyaAddons.includes(kalit) ?? false;
            return (
              <button
                key={kalit}
                type="button"
                onClick={() => onAddon(kalit)}
                aria-pressed={tanlangan}
                className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                  tanlangan
                    ? "border-brand bg-brand-wash/60 shadow-card"
                    : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    tanlangan ? "border-brand bg-brand text-brand-fg" : "border-line-strong bg-surface"
                  }`}
                >
                  {tanlangan && <Check size={14} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-fg">{addon.nomi}</span>
                    {tavsiya && (
                      <span className="rounded-full bg-brand-wash px-2 py-0.5 text-2xs font-medium text-brand">
                        Sizga tavsiya etiladi
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{addon.tavsif}</span>
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-fg">
                  +{somFormat(addon.oylikNarx)}
                  <span className="text-faint"> / oy</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-2xs text-faint">
          Tavsiya — shunchaki tavsiya: hech bir pullik modul sizning tanlovingizsiz qo'shilmaydi.
        </p>
      </Bosqich>

      <Bosqich raqam={4} sarlavha="To'lov davri">
        <Segmented<TolovDavri>
          options={[
            { value: "oylik", label: "Oylik" },
            { value: "yillik", label: "Yillik — 2 oy bepul" },
          ]}
          value={holat.davr}
          onChange={onDavr}
          className="max-w-sm"
        />
      </Bosqich>
    </div>
  );
}
