"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatSom, formatToshkentVaqt } from "@/lib/format";
import { DAVR_YORLIQ, type KassaDavr } from "@/lib/kassaDavr";
import type { TransferDTO } from "@/lib/queries/accounts";

/** Ro'yxatdagi davr filtri — sana oralig'i bu yerda emas, kassa detalida. */
const FILTRLAR: KassaDavr[] = ["bugun", "hafta", "oy", "barchasi"];

/**
 * Yakunlanmagan holatlar yorlig'i. "bajarildi" ataylab yorliqsiz — u odatiy
 * holat va har qatorga rangli belgi qo'yish ro'yxatni o'qib bo'lmas qiladi.
 */
const HOLAT_YORLIQ: Record<string, { matn: string; tone: "neutral" | "chiqim" }> = {
  rad: { matn: "Rad etilgan", tone: "chiqim" },
  bekor: { matn: "Bekor qilingan", tone: "neutral" },
  arxiv: { matn: "Arxiv", tone: "neutral" },
};

/**
 * KASSA HARAKATLARI — "pul kimdan kimga o'tdi" savoliga javob.
 *
 * Vaqt o'qi bo'yicha ixcham lenta: har qatorda vaqt, yo'nalish, summa, turi
 * va kim yaratgani. Tasdiq kutayotganlar bu yerda YO'Q — ular tepadagi
 * panelda harakat talab qilib turibdi va ikki joyda ko'rinishi bir voqeani
 * ikkiga bo'lardi.
 *
 * Filtr havola (`?davr=`) orqali — server sahifasi qayta render bo'ladi va
 * ro'yxat BAZADAN kesib olinadi. Client'da filtrlash uchun avval hamma
 * yozuvni yuklab olish kerak bo'lardi.
 */
export function HarakatlarPaneli({
  harakatlar,
  davr,
}: {
  harakatlar: TransferDTO[];
  davr: KassaDavr;
}) {
  return (
    <section id="harakatlar" className="bg-surface border border-line rounded-2xl shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 pt-4 pb-3">
        <h2 className="font-semibold text-fg">Kassa harakatlari</h2>
        {/* Gorizontal siljish faqat SHU qatorda — sahifa siljimaydi. */}
        <nav className="flex gap-1 p-1 rounded-lg bg-surface-2 overflow-x-auto max-w-full">
          {FILTRLAR.map((f) => (
            <Link
              key={f}
              href={`/app/kassa?davr=${f}#harakatlar`}
              scroll={false}
              className={`px-3 min-h-[36px] flex items-center rounded-md text-xs font-medium whitespace-nowrap transition ${
                f === davr ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
              }`}
            >
              {DAVR_YORLIQ[f]}
            </Link>
          ))}
        </nav>
      </div>

      {harakatlar.length === 0 ? (
        <p className="px-4 sm:px-5 pb-4 text-2xs text-faint">
          {davr === "barchasi"
            ? "Hali kassa harakati yo'q"
            : `${DAVR_YORLIQ[davr]} kesimida kassa harakati yo'q`}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {harakatlar.map((t) => {
            const holat = HOLAT_YORLIQ[t.holat];
            const otmagan = t.holat === "bekor" || t.holat === "rad";
            const farq = t.farq ?? 0;
            return (
              <li key={t.id} className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`text-sm truncate ${otmagan ? "text-faint line-through" : "text-fg"}`}
                  >
                    {t.fromUserIsm ?? t.fromNomi} → {t.toUserIsm ?? t.toNomi}
                  </p>
                  <p className="text-2xs text-faint mt-0.5">
                    {formatToshkentVaqt(new Date(t.createdAt))} ·{" "}
                    {t.turi === "smena" ? "Kassani topshirish" : "Pul o'tkazish"}
                    {t.tasdiqlaganIsm ? ` · ${t.tasdiqlaganIsm}` : ""}
                  </p>
                  {t.izoh && <p className="text-2xs text-muted mt-0.5 break-words">{t.izoh}</p>}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="font-display tnum text-sm font-medium text-fg whitespace-nowrap">
                    {formatSom(t.summa)}
                  </p>
                  {holat && <Badge tone={holat.tone}>{holat.matn}</Badge>}
                  {!holat && farq !== 0 && (
                    <p className="text-2xs tnum text-expense whitespace-nowrap">
                      Farq: − {formatSom(Math.abs(farq))}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
