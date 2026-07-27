/**
 * Disney Navoiy emblema (daraxt + quyosh + qushlar + ramka). Inline SVG —
 * `currentColor` orqali matn rangini oladi (light/dark'ga moslashadi).
 */
export function DisneyLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 250"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="12" y="12" width="176" height="226" strokeWidth="4" />
      <circle cx="100" cy="98" r="13" fill="currentColor" stroke="none" />
      <g strokeWidth="3">
        <line x1="100" y1="70" x2="100" y2="60" />
        <line x1="100" y1="136" x2="100" y2="126" />
        <line x1="72" y1="98" x2="62" y2="98" />
        <line x1="128" y1="98" x2="138" y2="98" />
        <line x1="80" y1="78" x2="73" y2="71" />
        <line x1="120" y1="78" x2="127" y2="71" />
        <line x1="80" y1="118" x2="73" y2="125" />
        <line x1="120" y1="118" x2="127" y2="125" />
      </g>
      <g fill="currentColor" stroke="none">
        <ellipse id="dl-lf" cx="100" cy="46" rx="7" ry="12" />
        <use href="#dl-lf" transform="rotate(30 100 98)" />
        <use href="#dl-lf" transform="rotate(60 100 98)" />
        <use href="#dl-lf" transform="rotate(90 100 98)" />
        <use href="#dl-lf" transform="rotate(120 100 98)" />
        <use href="#dl-lf" transform="rotate(150 100 98)" />
        <use href="#dl-lf" transform="rotate(210 100 98)" />
        <use href="#dl-lf" transform="rotate(240 100 98)" />
        <use href="#dl-lf" transform="rotate(300 100 98)" />
        <use href="#dl-lf" transform="rotate(330 100 98)" />
      </g>
      <g fill="currentColor" stroke="none">
        <ellipse id="dl-lf2" cx="100" cy="66" rx="5" ry="8.5" />
        <use href="#dl-lf2" transform="rotate(40 100 98)" />
        <use href="#dl-lf2" transform="rotate(80 100 98)" />
        <use href="#dl-lf2" transform="rotate(120 100 98)" />
        <use href="#dl-lf2" transform="rotate(160 100 98)" />
        <use href="#dl-lf2" transform="rotate(200 100 98)" />
        <use href="#dl-lf2" transform="rotate(320 100 98)" />
      </g>
      <g strokeWidth="4">
        <path d="M100 150 C 98 138 98 128 100 118" />
        <path d="M100 124 C 94 118 86 116 80 116" />
        <path d="M100 124 C 106 118 114 116 120 116" />
        <path d="M100 132 C 96 128 90 127 85 128" />
        <path d="M100 132 C 104 128 110 127 115 128" />
        <path d="M100 150 C 92 154 84 158 78 164" />
        <path d="M100 150 C 108 154 116 158 122 164" />
        <path d="M100 150 C 100 158 100 166 100 172" />
      </g>
      <g strokeWidth="3">
        <path d="M126 52 C 130 47 136 47 140 52 C 144 47 150 47 154 52" />
        <path d="M146 40 C 149 36 154 36 157 40 C 160 36 165 36 168 40" />
      </g>
      <text
        x="100"
        y="212"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="15"
        letterSpacing="3"
        fill="currentColor"
        stroke="none"
      >
        SINCE 2017
      </text>
    </svg>
  );
}

/** "Disney Navoiy" so'zligi (login uchun to'liq, nav uchun ixcham). */
export function DisneyWordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <span className="inline-flex flex-col leading-none">
      <span
        className={`font-semibold tracking-[0.18em] text-fg ${cls}`}
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        DISNEY
      </span>
      <span className="text-[0.6em] tracking-[0.35em] text-muted mt-0.5">NAVOIY</span>
    </span>
  );
}
