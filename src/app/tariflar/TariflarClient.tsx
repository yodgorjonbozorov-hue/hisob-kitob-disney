"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  narxHisobla,
  normalizeFiliallar,
  type AddonKey,
  type TolovDavri,
} from "@/lib/pricing/config";
import { biznesProfil, type BusinessType } from "@/lib/pricing/profil";
import { TanlovBloklari } from "./TanlovBloklari";
import { Xulosa, MobilXulosa } from "./Xulosa";

/**
 * Tarif kalkulyatori holati. Tanlovlar URL'da saqlanadi (yangilash/orqaga
 * tugmalari tanlovni yo'qotmaydi) va signup'ga o'sha parametrlar bilan
 * uzatiladi. URL — faqat onboarding tanlovi: narx serverda qayta hisoblanadi.
 */
export interface KalkulyatorHolat {
  yonalish: BusinessType | null;
  filiallar: number;
  addons: AddonKey[];
  davr: TolovDavri;
}

export function signupHavola(holat: KalkulyatorHolat): string {
  const p = new URLSearchParams();
  if (holat.yonalish) p.set("yonalish", holat.yonalish);
  if (holat.filiallar > 1) p.set("filiallar", String(holat.filiallar));
  if (holat.addons.length > 0) p.set("addons", holat.addons.join(","));
  if (holat.davr === "yillik") p.set("davr", "yillik");
  const qs = p.toString();
  return qs ? `/signup?${qs}` : "/signup";
}

export default function TariflarClient({ boshlangich }: { boshlangich: KalkulyatorHolat }) {
  const router = useRouter();
  const pathname = usePathname();
  const [holat, setHolat] = useState<KalkulyatorHolat>(boshlangich);

  const yangila = useCallback(
    (qisman: Partial<KalkulyatorHolat>) => {
      // router.replace setState updater ICHIDA chaqirilmaydi (updater sof
      // bo'lishi shart, aks holda navigatsiya yutilib ketadi) — yangi holat
      // avval hisoblanadi, keyin state va URL alohida yangilanadi.
      const yangi = { ...holat, ...qisman };
      setHolat(yangi);
      // Tanlov URL'da qoladi — sahifa yangilansa ham yo'qolmaydi.
      const p = new URLSearchParams();
      if (yangi.yonalish) p.set("yonalish", yangi.yonalish);
      if (yangi.filiallar > 1) p.set("filiallar", String(yangi.filiallar));
      if (yangi.addons.length > 0) p.set("addons", yangi.addons.join(","));
      if (yangi.davr === "yillik") p.set("davr", "yillik");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [holat, router, pathname]
  );

  const profil = useMemo(() => biznesProfil(holat.yonalish), [holat.yonalish]);
  const narx = useMemo(
    () =>
      narxHisobla({
        filiallar: normalizeFiliallar(holat.filiallar),
        addons: holat.addons,
        davr: holat.davr,
      }),
    [holat.filiallar, holat.addons, holat.davr]
  );

  function addonAlmashtir(kalit: AddonKey) {
    const bor = holat.addons.includes(kalit);
    yangila({ addons: bor ? holat.addons.filter((a) => a !== kalit) : [...holat.addons, kalit] });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 lg:pb-10">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <TanlovBloklari
          holat={holat}
          profil={profil}
          onYonalish={(y) => yangila({ yonalish: y })}
          onFiliallar={(f) => yangila({ filiallar: normalizeFiliallar(f) })}
          onAddon={addonAlmashtir}
          onDavr={(d) => yangila({ davr: d })}
        />
        <Xulosa holat={holat} profil={profil} narx={narx} />
      </div>
      <MobilXulosa holat={holat} narx={narx} />
    </div>
  );
}
