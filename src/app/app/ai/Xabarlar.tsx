"use client";

import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { javobBloklari, havolaXavfsizmi } from "@/lib/ai/javobFormat";
import type { Xabar } from "./turlar";

/**
 * SUHBAT LENTASI.
 *
 * Foydalanuvchi xabari — o'ng tomonda, to'ldirilgan pufak. AI javobi —
 * chap tomonda, pufaksiz: moliyaviy raqamlar rangli fon ustida emas,
 * toza yuzada yaxshi o'qiladi. Raqamli qatorlar metrik ko'rinishida
 * (yorliq chapda, summa o'ngda) chiziladi — telefonda ham skanerlanadi.
 */
export function Xabarlar({
  xabarlar,
  kutilmoqda,
  xato,
  onTaklif,
  onQayta,
}: {
  xabarlar: Xabar[];
  kutilmoqda: boolean;
  xato: string | null;
  onTaklif: (savol: string) => void;
  onQayta: () => void;
}) {
  const oxirgi = xabarlar.length - 1;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {xabarlar.map((x, i) =>
        x.rol === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand text-brand-fg px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
              {x.matn}
            </div>
          </div>
        ) : (
          <div key={i} className="space-y-3">
            <Javob matn={x.matn} />
            <Havolalar havolalar={x.havolalar} />
            {i === oxirgi && !kutilmoqda && (x.takliflar?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {x.takliflar!.map((t) => (
                  <button
                    key={t}
                    onClick={() => onTaklif(t)}
                    className="px-3 py-1.5 rounded-full text-xs text-muted border border-line hover:border-brand hover:text-brand transition min-h-[36px]"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {kutilmoqda && (
        <p className="text-sm text-muted flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" aria-hidden="true" />
          Balansa ma&apos;lumotlarni tahlil qilmoqda...
        </p>
      )}

      {xato && (
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 space-y-2">
          <p className="text-sm text-fg">{xato}</p>
          <button
            onClick={onQayta}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand min-h-[36px]"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Qayta urinish
          </button>
        </div>
      )}
    </div>
  );
}

/** AI javobi — bloklarga ajratilgan holda (metrik / punkt / matn). */
function Javob({ matn }: { matn: string }) {
  return (
    <div className="space-y-1.5 text-sm text-fg">
      {javobBloklari(matn).map((b, i) => {
        if (b.tur === "metrik") {
          return (
            <div key={i} className="flex items-baseline justify-between gap-3 py-0.5">
              <span className="text-muted">{b.yorliq}</span>
              <span className="font-display font-semibold tabular-nums text-right">{b.qiymat}</span>
            </div>
          );
        }
        if (b.tur === "sarlavha") {
          return (
            <p key={i} className="font-semibold text-fg pt-1">
              {b.matn}
            </p>
          );
        }
        if (b.tur === "punkt") {
          return (
            <p key={i} className="pl-4 relative text-muted">
              <span className="absolute left-0 text-faint" aria-hidden="true">
                •
              </span>
              {b.matn}
            </p>
          );
        }
        return (
          <p key={i} className="leading-relaxed break-words">
            {b.matn}
          </p>
        );
      })}
    </div>
  );
}

/** Drill-down tugmalari — faqat ilova ichidagi `/app/...` manzillar. */
function Havolalar({ havolalar }: { havolalar?: { yorliq: string; href: string }[] }) {
  const xavfsiz = (havolalar ?? []).filter((h) => havolaXavfsizmi(h.href));
  if (xavfsiz.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {xavfsiz.map((h) => (
        <Link
          key={h.href}
          href={h.href}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 text-xs font-medium text-fg hover:bg-line transition min-h-[36px]"
        >
          {h.yorliq}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
