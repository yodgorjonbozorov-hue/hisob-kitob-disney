import Link from "next/link";
import {
  Boxes,
  Car,
  Handshake,
  Sparkles,
  Store,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { BIZNES_PROFILLAR, type BusinessType } from "@/lib/pricing/profil";
import { Bolim, BolimIzoh, BolimSarlavha } from "./qismlar";

/**
 * "Kimlar uchun" — biznes yo'nalishlari. ATAYLAB NARXSIZ: xabar "Balansa
 * biznesingizga moslashadi", tariflar esa alohida sahifada (bitta yagona
 * narx tizimi — yo'nalish narxni o'zgartirmaydi).
 *
 * Kartadagi matn va urg'ular lib/pricing/profil.ts dan olinadi — landing,
 * tariflar sahifasi va onboarding bir xil manbadan gapiradi.
 */
const KORSATILADIGAN: { code: BusinessType; ikon: LucideIcon }[] = [
  { code: "auto", ikon: Car },
  { code: "perfume", ikon: Sparkles },
  { code: "food", ikon: Store },
  { code: "agro", ikon: Wheat },
  { code: "service", ikon: Handshake },
  { code: "wholesale", ikon: Boxes },
];

export function KimlarUchun() {
  return (
    <Bolim id="kimlar" eni={1100}>
      <BolimSarlavha>Balansa biznesingizga moslashadi</BolimSarlavha>
      <p data-reveal className="m-0 mt-5 max-w-[60ch] text-[17px] leading-[1.7] text-muted">
        Bitta Balansa — har qanday biznesga mos. Yo&apos;nalishingizni tanlasangiz, Balansa kerakli
        bo&apos;limlarni oldindan sozlab beradi. Narx hamma uchun bir xil tizimdan hisoblanadi.
      </p>

      <div className="mt-10 grid grid-cols-3 gap-5 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
        {KORSATILADIGAN.map(({ code, ikon: Ikon }) => {
          const p = BIZNES_PROFILLAR[code];
          return (
            <Link
              key={code}
              href={`/tariflar?yonalish=${code}`}
              data-reveal
              className="group flex flex-col rounded-[16px] border border-line bg-surface p-6 shadow-card transition-[border-color,box-shadow] hover:border-brand-300 hover:shadow-lift"
            >
              <Ikon size={24} className="text-brand" aria-hidden />
              <h3 className="m-0 mt-3.5 font-heading text-[18px] font-semibold text-fg">
                {p.label}
              </h3>
              <p className="m-0 mt-1.5 text-[14px] leading-[1.6] text-muted">{p.tavsif}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.urgular.map((u) => (
                  <span
                    key={u}
                    className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-muted"
                  >
                    {u}
                  </span>
                ))}
              </div>
              <span className="mt-5 text-[14px] font-semibold text-brand group-hover:underline">
                Balansa&apos;ni moslash →
              </span>
            </Link>
          );
        })}
      </div>

      <p data-reveal className="m-0 mt-6 text-[14px] text-faint">
        Ishlab chiqarish yoki boshqa yo&apos;nalishmi?{" "}
        <Link href="/tariflar" className="font-medium text-brand hover:underline">
          Balansa baribir moslashadi →
        </Link>
      </p>

      <BolimIzoh savol="«Bu mening biznesimga to'g'ri keladimi?»" />
    </Bolim>
  );
}
