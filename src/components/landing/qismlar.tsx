/**
 * Landing bo'limlarida takrorlanadigan mayda qismlar.
 *
 * Dizayn manbasi: `Balansa Landing.dc.html` (Claude Design handoff).
 * Ranglar dizayn tokenlariga tushirilgan (`--bg`→`bg-app`, `--card`→`bg-surface`,
 * `--sunk`→`bg-surface-2`, `--in`→`income`, `--out`→`expense`, `--warn`→`debt`),
 * shu bois qorong'i mavzu ilova bilan bir xil palitrada qoladi.
 *
 * Qorong'i bo'limlar (hero, yakuniy CTA, footer, telefon maketi) mavzudan
 * QAT'I NAZAR qorong'i turadi — u yerda ranglar to'g'ridan-to'g'ri hex bilan.
 */

/** Katta bo'lim sarlavhasi — Poppins 600, 44px (telefonda 28px). */
export function BolimSarlavha({
  children,
  olcham = 44,
}: {
  children: React.ReactNode;
  /** Dizaynda ikki o'lcham bor: 44px (odatiy) va 48px (Kunlik hisobot). */
  olcham?: 44 | 48;
}) {
  return (
    <h2
      data-reveal
      className={`m-0 font-heading font-semibold leading-[1.1] tracking-[-0.02em] text-fg max-[900px]:text-[28px] ${
        olcham === 48 ? "text-[48px]" : "text-[44px]"
      }`}
    >
      {children}
    </h2>
  );
}

/**
 * Bo'lim oxiridagi punktir izoh — «Bu bo'lim javob beradi: …».
 * Dizaynda har bo'lim qaysi savolga javob berishini ko'rsatadi.
 */
export function BolimIzoh({ savol }: { savol: string }) {
  return (
    <p className="mt-16 flex items-center gap-2.5 border-t border-dashed border-line-strong pt-4 text-[13px] text-faint">
      <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-brand" />
      Bu bo&apos;lim javob beradi: {savol}
    </p>
  );
}

/**
 * Pul summasi — Manrope 700, tabular. `sanoq` berilsa sahifa ko'rinishga
 * kirganda 0 dan shu songacha sanaydi (`LandingMotion`).
 * Matn statik holatda ham to'g'ri turadi: JS ishlamasa ham yakuniy son ko'rinadi.
 */
export function Pul({
  qiymat,
  sanoq = false,
  className = "",
}: {
  qiymat: number;
  sanoq?: boolean;
  className?: string;
}) {
  return (
    <span
      data-count={sanoq ? qiymat : undefined}
      className={`font-display font-bold tabular-nums ${className}`}
    >
      {pulMatni(qiymat)}
    </span>
  );
}

/**
 * "6 650 000" / "−340 000" ko'rinishi. Minus — U+2212 (chin minus),
 * defis emas: raqam ustunlarida balandligi bir xil turadi.
 * `LandingMotion` sanoq paytida AYNI shu formatni ishlatadi.
 */
export function pulMatni(qiymat: number): string {
  const raqam = Math.abs(Math.round(qiymat))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (qiymat < 0 ? "−" : "") + raqam;
}

/**
 * Qorong'i bo'limlar ustidagi juda past kontrastli "shovqin" qatlami —
 * gradient bandlarini (banding) yo'qotadi. SVG filtri data-URI ichida,
 * shu bois tashqi so'rov yo'q (CSP `img-src 'self' data:` bilan mos).
 */
export function Shovqin() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

/** Qorong'i bo'lim oxiridagi punktir izoh (hero) — yorug' variantining juftligi. */
export function QorongIzoh({ savol }: { savol: string }) {
  return (
    <p className="m-0 flex items-center gap-2.5 border-t border-dashed border-[#223E3B] pt-4 text-[13px] text-[#E2F0EE]/[0.45]">
      <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-[#5EEAD4]" />
      Bu bo&apos;lim javob beradi: {savol}
    </p>
  );
}

/**
 * Landing bo'limi — dizayndagi ritm: 128px vertikal bo'shliq (telefonda 80px),
 * 40px yon chekka (telefonda 20px). Fon navbatma-navbat almashadi:
 * `app` (sahifa foni) → `surface` (karta foni, ustki-pastki chiziq bilan).
 */
export function Bolim({
  id,
  fon = "app",
  eni = 1200,
  children,
}: {
  id?: string;
  fon?: "app" | "surface";
  /** Ichki ustunning maksimal kengligi (px) — dizaynda 840…1200 orasida. */
  eni?: 840 | 1000 | 1100 | 1200;
  children: React.ReactNode;
}) {
  const enKlass = {
    840: "max-w-[840px]",
    1000: "max-w-[1000px]",
    1100: "max-w-[1100px]",
    1200: "max-w-[1200px]",
  }[eni];

  return (
    <section
      id={id}
      // Panel sticky (68px) — havola bosilganda sarlavha panel ostida qolmasin.
      className={`px-10 py-32 max-[900px]:px-5 max-[900px]:py-20 ${
        fon === "surface" ? "border-y border-line bg-surface" : "bg-app"
      } ${id ? "scroll-mt-[68px]" : ""}`}
    >
      <div className={`mx-auto ${enKlass}`}>{children}</div>
    </section>
  );
}
