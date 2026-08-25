"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { havolaXavfsizmi } from "@/lib/ai/javobFormat";
import type { BugungiXulosa } from "@/lib/ai/xulosa";

/**
 * BOSH EKRAN (bo'sh suhbat).
 *
 * "Bugungi xulosa" — AI'siz: raqamlar serverda deterministik hisoblangan
 * (`lib/ai/xulosa.ts`), ya'ni sahifa ochilishi bitta ham AI so'rovi
 * sarflamaydi va bu raqamlar hech qachon "o'ylab topilmagan" bo'ladi.
 *
 * Tayyor savollar biznesdagi MAVJUD modullarga qarab chiqadi: CRM yo'q
 * bo'lsa CRM savoli, ombor yo'q bo'lsa ombor savoli umuman ko'rinmaydi.
 */
export function BoshHolat({
  savollar,
  xulosa,
  aiUlangan,
  onSavol,
}: {
  savollar: string[];
  xulosa: BugungiXulosa;
  aiUlangan: boolean;
  onSavol: (savol: string) => void;
}) {
  // `my-auto` (justify-center EMAS): kontent ekrandan baland bo'lsa markazlash
  // uning yuqori qismini kesib qo'yadi va unga siljib ham yetib bo'lmaydi —
  // telefonda aynan shunday bo'lgan edi.
  return (
    <div className="min-h-full flex flex-col px-4 lg:px-6 py-5 sm:py-8">
      <div className="w-full max-w-2xl mx-auto my-auto space-y-5 sm:space-y-7">
        <div className="text-center space-y-2">
          <Sparkles className="w-7 h-7 mx-auto text-brand" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-fg">Balansa AI</h2>
          <p className="text-sm text-muted">Biznesingiz haqida istalgan savolni bering.</p>
          <p className="sm:hidden text-2xs text-faint">
            AI faqat o&apos;qiydi — yozuv kiritmaydi.
          </p>
        </div>

        {!aiUlangan && (
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-center space-y-1">
            <p className="text-sm font-medium text-fg">AI hali ulanmagan</p>
            <p className="text-xs text-muted">
              Administrator serverga <code className="px-1 py-0.5 rounded bg-surface">ANTHROPIC_API_KEY</code> qo&apos;shishi
              bilan bu bo&apos;lim ishga tushadi. Quyidagi bugungi kesim esa hozir ham haqiqiy.
            </p>
          </div>
        )}

        {xulosa.kuzatuvlar.length > 0 && (
          <section className="rounded-xl border border-line divide-y divide-line">
            <h3 className="px-4 py-2.5 text-2xs font-medium uppercase tracking-wide text-faint">
              Bugungi xulosa
            </h3>
            {xulosa.kuzatuvlar.map((k) => (
              <div key={k.yorliq} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <span className={`text-xs ${k.ogoh ? "text-expense-fg" : "text-muted"}`}>{k.yorliq}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-display font-semibold tabular-nums text-fg truncate">
                    {k.qiymat}
                  </span>
                  {k.havola && havolaXavfsizmi(k.havola.href) && (
                    <Link
                      href={k.havola.href}
                      className="text-2xs text-brand shrink-0 hover:underline"
                    >
                      {k.havola.yorliq}
                    </Link>
                  )}
                </span>
              </div>
            ))}
          </section>
        )}

        {savollar.length > 0 && (
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:justify-center">
            {savollar.map((s) => (
              <button
                key={s}
                onClick={() => onSavol(s)}
                className="px-3 py-2.5 rounded-xl border border-line text-xs text-muted text-left sm:text-center hover:border-brand hover:text-brand transition min-h-[44px]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
