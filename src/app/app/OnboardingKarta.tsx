import Link from "next/link";
import { Card } from "@/components/ui/Card";

/**
 * BIRINCHI KIRISH ONBOARDINGI — sinov davridagi biznes uchun yo'nalishga
 * moslashgan 3 qadam (lib/pricing/profil.ts dan). Qadamlar bajarilgani
 * HAQIQIY ma'lumotdan aniqlanadi (mahsulot/sotuv/mijoz soni) — sun'iy
 * "bajarildi" belgisi yo'q. Hammasi bajarilgach karta o'zi yo'qoladi
 * (page.tsx shartida).
 */
export interface OnboardingQadamKorinish {
  label: string;
  href: string;
  bajarildi: boolean;
}

export function OnboardingKarta({
  biznesNomi,
  yonalishLabel,
  kunQoldi,
  qadamlar,
}: {
  biznesNomi: string;
  yonalishLabel: string | null;
  /** Sinov tugashiga qolgan kunlar (computeAccess'dan) — null bo'lsa chip chizilmaydi. */
  kunQoldi: number | null;
  qadamlar: OnboardingQadamKorinish[];
}) {
  return (
    <Card className="border-brand/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading font-semibold text-fg">
            Xush kelibsiz — Balansa tayyor 🎉
          </h2>
          <p className="mt-1 text-sm text-muted">
            <span className="font-medium text-fg">{biznesNomi}</span>
            {yonalishLabel && <> · {yonalishLabel}</>}
          </p>
        </div>
        {kunQoldi !== null && kunQoldi >= 0 && (
          <span className="rounded-full bg-brand-wash px-3 py-1 text-xs font-medium text-brand">
            Sinov: {kunQoldi} kun qoldi
          </span>
        )}
      </div>
      <ol className="mt-4 space-y-2.5">
        {qadamlar.map((q, i) => (
          <li key={q.href + q.label}>
            <Link
              href={q.href}
              className="group flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-brand/50 hover:bg-surface-2"
            >
              <span
                aria-hidden
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  q.bajarildi ? "bg-income text-white" : "bg-surface-2 text-muted"
                }`}
              >
                {q.bajarildi ? "✓" : i + 1}
              </span>
              <span
                className={`text-sm font-medium ${
                  q.bajarildi ? "text-faint line-through" : "text-fg group-hover:text-brand"
                }`}
              >
                {q.label}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
