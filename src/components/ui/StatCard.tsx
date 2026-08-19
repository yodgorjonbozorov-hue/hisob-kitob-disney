import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { formatPercent, changeDirection } from "@/lib/format";
import { YASHIRIN_BELGI } from "@/lib/pulYashirish";

/**
 * KPI kartasi: sarlavha + katta qiymat (tabular) + o'tgan davrga nisbatan Δ.
 * `goodWhenUp` — o'sish yaxshimi (kirim uchun true, chiqim uchun false):
 * shu asosda o'q rangi yashil/qizil bo'ladi.
 *
 * `href` berilsa karta butunlay bosiladigan bo'ladi (ichki havola emas —
 * barmoq bilan nishonga tegish oson bo'lsin), `title` esa uzun raqamning
 * to'liq ko'rinishini hoverda beradi.
 */
export function StatCard({
  label,
  value,
  changePct = null,
  goodWhenUp = true,
  accent = "neutral",
  href,
  onClick,
  title,
  className = "",
  yashirin = false,
  onYashir,
  children,
}: {
  label: string;
  value: string;
  changePct?: number | null;
  goodWhenUp?: boolean;
  accent?: "income" | "expense" | "neutral" | "brand" | "debt";
  href?: string;
  /** `href` o'rniga — kartani bosganda oyna ochish uchun (klient komponentda). */
  onClick?: () => void;
  title?: string;
  /** Grid ichidagi joylashuv uchun (masalan `col-span-2 lg:col-span-1`). */
  className?: string;
  /** Summa yashiringanmi — o'rniga nuqtalar chiqadi. */
  yashirin?: boolean;
  /**
   * Berilsa — sarlavha yonida ko'z tugmasi chiqadi (klient komponentda).
   * Berilmasa karta oldingidek, hech qanday tugmasiz ishlaydi.
   */
  onYashir?: () => void;
  children?: React.ReactNode;
}) {
  const dir = changeDirection(changePct);
  const isGood = dir === "flat" ? null : (dir === "up") === goodWhenUp;
  const deltaClass =
    isGood === null ? "text-faint" : isGood ? "text-income" : "text-expense";

  const accentClass = {
    income: "text-income",
    expense: "text-expense",
    brand: "text-brand",
    debt: "text-debt",
    neutral: "text-fg",
  }[accent];

  const sarlavha = (
    <p className="text-muted text-sm mb-1 flex items-center gap-1">
      {label}
      {(href || onClick) && (
        <span aria-hidden className="text-faint">
          ›
        </span>
      )}
    </p>
  );

  const summa = (
    <>
      <p
        /* Yashiringanda nuqtalar SO'NIQ rangda: yashil/qizil nuqtalar
           qiymatdek ko'rinib, "nimadir yozilgan" degan taassurot berardi. */
        className={`text-xl sm:text-2xl font-semibold tnum ${yashirin ? "text-faint" : accentClass}`}
        /* Yashiringanda `title` BERILMAYDI: aks holda sichqonchani ustiga
           olib borish bilan aynan yashirilgan summa ko'rinib qolardi. */
        title={yashirin ? undefined : title}
      >
        {yashirin ? YASHIRIN_BELGI : value}
      </p>
      {changePct !== null && (
        <p className={`text-2xs mt-1 flex items-center gap-1 tnum ${deltaClass}`}>
          {dir === "up" ? "▲" : dir === "down" ? "▼" : "•"} {formatPercent(changePct)}
          <span className="text-faint">o'tgan oyga nisbatan</span>
        </p>
      )}
      {children}
    </>
  );

  const ichi = (
    <>
      {sarlavha}
      {summa}
    </>
  );

  const asos = `bg-surface rounded-2xl shadow-card border border-line p-4 sm:p-5 ${className}`;
  const bosiladi =
    "transition hover:border-brand hover:shadow-md active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";

  /*
   * KO'Z TUGMASI BO'LGAN KARTA.
   *
   * Butun kartani `<button>` qilib qo'yib, ichiga yana bitta tugma
   * joylashtirib bo'lmaydi (HTML buni taqiqlaydi, brauzer esa bosishlarni
   * chalkashtiradi). Shuning uchun tashqarisi oddiy `div`, bosiladigan
   * qism — summa bloki, ko'z esa sarlavha qatorida yonida turadi.
   */
  if (onYashir) {
    const kozTugmasi = (
      <button
        type="button"
        onClick={onYashir}
        aria-pressed={yashirin}
        title={yashirin ? "Summani ko'rsatish" : "Summani yashirish"}
        aria-label={`${label}: ${yashirin ? "summani ko'rsatish" : "summani yashirish"}`}
        className="shrink-0 -m-2 p-2 text-faint hover:text-fg transition"
      >
        {yashirin ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    );

    return (
      <div className={asos}>
        <div className="flex items-start justify-between gap-2">
          {sarlavha}
          {kozTugmasi}
        </div>
        {href ? (
          <Link href={href} className={`block rounded-xl ${bosiladi}`}>
            {summa}
          </Link>
        ) : onClick ? (
          <button type="button" onClick={onClick} className={`block w-full text-left rounded-xl ${bosiladi}`}>
            {summa}
          </button>
        ) : (
          summa
        )}
      </div>
    );
  }

  if (href) {
    return (
      <Link href={href} className={`${asos} block ${bosiladi}`}>
        {ichi}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${asos} block w-full text-left ${bosiladi}`}>
        {ichi}
      </button>
    );
  }
  return <div className={asos}>{ichi}</div>;
}
