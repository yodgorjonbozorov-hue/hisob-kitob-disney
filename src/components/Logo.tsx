/**
 * Balansa logotipi — tarozi + o'sish grafigi shaklidagi abstrakt belgi.
 *
 * Ranglar dizayn tokenlaridan olinadi (`--brand`, `--fg`), shu bois light/dark mavzuga
 * o'zi moslashadi. `inverted` — mavzudan qat'i nazar doimo qorong'i fon ustida
 * ishlatilganda (masalan brend rangli banner).
 *
 * Qoidalar (docs/BRAND.md): cho'zish, aylantirish, soya qo'shish yoki rangini
 * o'zgartirish taqiqlanadi. Minimal o'lcham: belgi 24px, lockup 120px kenglik.
 */

type LogoProps = {
  /** 'full' = belgi + "Balansa" so'zligi, 'icon' = faqat belgi */
  variant?: "full" | "icon";
  /** qorong'i fon ustida majburan ishlatilganda */
  inverted?: boolean;
  /** balandlik, px */
  height?: number;
  className?: string;
};

/** Belgi geometriyasi — icon va full variantda bir xil (public/logo-*.svg bilan mos). */
function Mark({ mark, accent }: { mark: string; accent: string }) {
  return (
    <>
      <rect x="234" y="196" width="44" height="216" rx="8" fill={mark} />
      <rect x="88" y="164" width="336" height="56" rx="28" fill={mark} />
      <rect x="96" y="88" width="320" height="56" rx="28" fill={accent} />
      <path d="M76 244h140c0 38.66-31.34 70-70 70s-70-31.34-70-70z" fill={mark} />
      <path d="M296 244h140c0 38.66-31.34 70-70 70s-70-31.34-70-70z" fill={mark} />
    </>
  );
}

export function Logo({ variant = "full", inverted = false, height = 32, className = "" }: LogoProps) {
  const mark = inverted ? "#2DD4BF" : "rgb(var(--brand))";
  const accent = "#5EEAD4";
  const text = inverted ? "#FFFFFF" : "rgb(var(--fg))";

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 512 512"
        height={height}
        width={height}
        role="img"
        aria-label="Balansa"
        className={className}
      >
        <Mark mark={mark} accent={accent} />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 880 220"
      height={height}
      width={(height * 880) / 220}
      role="img"
      aria-label="Balansa"
      className={className}
    >
      <g transform="translate(20, 22) scale(0.34)">
        <Mark mark={mark} accent={accent} />
      </g>
      <text
        x="212"
        y="140"
        fontFamily="var(--font-poppins), Poppins, var(--font-inter), Inter, system-ui, sans-serif"
        fontSize="104"
        fontWeight="700"
        letterSpacing="-2"
        fill={text}
      >
        Balansa
      </text>
    </svg>
  );
}
