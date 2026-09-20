import { cn } from "@/lib/cn";
import { formatSom, pulBelgisi } from "@/lib/format";

type Tone = "income" | "expense" | "debt" | "brand" | "neutral";
type Size = "sm" | "md" | "lg" | "xl" | "display";

const toneClass: Record<Tone, string> = {
  income: "text-income",
  expense: "text-expense",
  debt: "text-debt",
  brand: "text-brand",
  neutral: "text-fg",
};

/**
 * Katta o'lchamlar telefonda bir pog'ona kichik: summa `whitespace-nowrap`
 * bo'lgani uchun "1 234 567 soʻm" 34px da tor kartadan chiqib ketardi —
 * sahifa chetida kesilib, raqamning oxiri KO'RINMAY qolardi.
 */
const sizeClass: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-base sm:text-lg",
  xl: "text-lg sm:text-2xl",
  display: "text-xl sm:text-3xl",
};

/**
 * Barcha pul ko'rsatishlari SHU komponent orqali (REDESIGN.md 8).
 * Manrope (font-display), tabular. `tone` — rang; agar tone berilmasa,
 * `signed` bo'lsa qiymat belgisidan aniqlanadi.
 *
 * MANFIY QIYMAT HAR DOIM `−` BILAN CHIQADI — `signed` dan QAT'I NAZAR
 * (belgi qoidasi: lib/format.ts `pulBelgisi`). `signed` endi faqat MUSBAT
 * qiymatga `+` qo'shadi. Ilgari `signed={false}` da minus butunlay tushib
 * qolardi va Kassalar / Mening kassam / CRM xodim kassasi ekranlarida
 * −17 450 000 lik qoldiq "17 450 000" bo'lib ko'rinardi — rang belgining
 * o'rnini bosa olmaydi.
 */
export function Money({
  value,
  size = "md",
  tone,
  signed = false,
  suffix = true,
  className,
}: {
  value: number;
  size?: Size;
  tone?: Tone;
  signed?: boolean;
  suffix?: boolean;
  className?: string;
}) {
  const effectiveTone: Tone = tone ?? (signed ? (value >= 0 ? "income" : "expense") : "neutral");
  const sign = pulBelgisi(value, signed);
  const abs = Math.abs(value);
  return (
    <span className={cn("font-display tnum whitespace-nowrap", sizeClass[size], toneClass[effectiveTone], className)}>
      {sign}
      {formatSom(abs)}
      {suffix && <span className="font-sans font-medium text-[0.7em] text-faint ml-1">soʻm</span>}
    </span>
  );
}
