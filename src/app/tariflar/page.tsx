import { PublicShell } from "@/components/public/PublicShell";
import { BRAND } from "@/lib/brand";
import { isAddonKey, normalizeFiliallar, type AddonKey } from "@/lib/pricing/config";
import { isBusinessType } from "@/lib/pricing/profil";
import TariflarClient, { type KalkulyatorHolat } from "./TariflarClient";
import { AsosiyImkoniyatlar, ImkoniyatMatritsasi, TariflarSavollari } from "./qismlar";

export const metadata = {
  title: `Tariflar — ${BRAND.nomi}`,
  description:
    "Bitta Balansa — har qanday biznesga mos. Narxni o'zingiz hisoblang: asosiy tizim + filiallar + kerakli modullar. 14 kun bepul.",
};

/**
 * TARIFLAR — yagona narx tizimi sahifasi.
 *
 * MUHIM QOIDA: biznes yo'nalishi narxni O'ZGARTIRMAYDI. Bir xil filial soni
 * va bir xil modullar tanlagan har qanday ikki biznes BIR XIL to'laydi.
 * Yo'nalish faqat tavsiyalar va boshlang'ich sozlashni moslashtiradi.
 *
 * URL parametrlari (yonalish/filiallar/addons/davr) — ishonchsiz onboarding
 * tanlovi: yaroqsiz qiymat jimgina 1-holatga tushadi, narx serverda qayta
 * hisoblanadi (lib/pricing/config.ts — yagona manba).
 */
function boshlangichHolat(searchParams: Record<string, string | string[] | undefined>): KalkulyatorHolat {
  const birinchi = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const yonalishRaw = birinchi(searchParams.yonalish);
  const addons = (birinchi(searchParams.addons) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(isAddonKey)
    .filter((v, i, arr) => arr.indexOf(v) === i) as AddonKey[];
  return {
    yonalish: isBusinessType(yonalishRaw) ? yonalishRaw : null,
    filiallar: normalizeFiliallar(birinchi(searchParams.filiallar)),
    addons,
    davr: birinchi(searchParams.davr) === "yillik" ? "yillik" : "oylik",
  };
}

export default function TariflarPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <PublicShell>
      <header className="mx-auto max-w-5xl px-4 pb-8 pt-12 text-center">
        <h1 className="font-heading text-xl font-semibold text-fg sm:text-2xl">
          Bitta Balansa. Har qanday biznesga mos.
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Biznes turi narxni o&apos;zgartirmaydi — Balansa biznesingizga moslashadi. Narx faqat
          filiallar soni va o&apos;zingiz tanlagan qo&apos;shimcha modullardan hisoblanadi.
        </p>
      </header>
      <TariflarClient boshlangich={boshlangichHolat(searchParams)} />
      <div className="border-t border-line">
        <AsosiyImkoniyatlar />
      </div>
      <ImkoniyatMatritsasi />
      <TariflarSavollari />
    </PublicShell>
  );
}
