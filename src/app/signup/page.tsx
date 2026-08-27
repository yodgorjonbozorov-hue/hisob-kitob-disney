import Link from "next/link";
import SignupForm, { type SignupBoshlangich } from "./SignupForm";
import { AuthShell } from "@/components/public/AuthShell";
import { BRAND } from "@/lib/brand";
import { isAddonKey, normalizeFiliallar, type AddonKey } from "@/lib/pricing/config";
import { isBusinessType } from "@/lib/pricing/profil";

export const metadata = {
  title: `Ro'yxatdan o'tish — ${BRAND.nomi}`,
};

/**
 * URL parametrlari (tariflar sahifasidan) — ISHONCHSIZ onboarding tanlovi.
 * Yaroqsiz qiymat jimgina tashlab yuboriladi: ?narx=1 kabi o'zgartirishlar
 * hech narsaga ta'sir qilmaydi, chunki narx/tarif serverda hisoblanadi.
 */
function boshlangichTanlov(searchParams: Record<string, string | string[] | undefined>): SignupBoshlangich {
  const birinchi = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const yonalishRaw = birinchi(searchParams.yonalish);
  const addonsRaw = birinchi(searchParams.addons) ?? "";
  const addons = addonsRaw
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

export default function SignupPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <AuthShell
      joriy="signup"
      sarlavha="Ro'yxatdan o'tish"
      tavsif={
        <>
          Biznesingiz uchun {BRAND.nomi} — <span className="font-medium text-fg">14 kun bepul</span>
        </>
      }
      ost={
        <>
          Allaqachon hisobingiz bormi?{" "}
          <Link href="/login" className="text-brand font-medium hover:underline">
            Kirish
          </Link>
        </>
      }
    >
      <SignupForm boshlangich={boshlangichTanlov(searchParams)} />
    </AuthShell>
  );
}
