"use client";

import { Card } from "@/components/ui/Card";
import { formatMoneyCompact, formatSom, formatSomLabel } from "@/lib/format";
import type { OmborKpiDTO } from "@/lib/queries/ombor";

/**
 * OMBOR KPI — to'rt raqam, boshqa hech narsa.
 *
 * "JAMI QOLDIQ" QO'SHIB YUBORILMAYDI. 500 dona gul va 120 kg qadoqni bitta
 * "620" raqamiga qo'shish matematik jihatdan ma'nosiz va foydalanuvchini
 * ishontirmaydi. Shu bois:
 *   - birlik BITTA bo'lsa — "3 256 dona" (aniq va tushunarli);
 *   - bir nechta bo'lsa — asosiy birlik katta raqamda, qolganlari ostida
 *     kichik satrda ("+ 120 kg, 40 litr").
 *
 * Telefonda 2 ustun, desktopda 4 — 375px ekranda to'rtta karta bir qatorda
 * o'qilmas darajada siqilib ketardi.
 */
export function KpiKartalar({ kpi }: { kpi: OmborKpiDTO }) {
  const asosiy = kpi.asosiy;
  const qolganlar = kpi.birliklar.filter((b) => b.birlik !== asosiy?.birlik);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      <Card className="p-3 sm:p-4">
        <p className="text-muted text-xs sm:text-sm mb-1">Mahsulot turlari</p>
        <p className="text-xl sm:text-2xl font-bold text-fg tnum">{kpi.turlarSoni}</p>
      </Card>

      <Card className="p-3 sm:p-4">
        <p className="text-muted text-xs sm:text-sm mb-1">Jami qoldiq</p>
        {asosiy ? (
          <>
            <p className="text-xl sm:text-2xl font-bold text-fg tnum break-words">
              {formatSom(asosiy.miqdor)}{" "}
              <span className="text-sm sm:text-base font-medium text-muted">{asosiy.birlik}</span>
            </p>
            {qolganlar.length > 0 && (
              <p className="text-2xs text-muted mt-1 truncate">
                + {qolganlar.map((b) => `${formatSom(b.miqdor)} ${b.birlik}`).join(", ")}
              </p>
            )}
          </>
        ) : (
          <p className="text-xl sm:text-2xl font-bold text-faint">0</p>
        )}
      </Card>

      {/* IXCHAM FORMAT: 375px ekranda "2 283 566 000 so'm" ikki qatorga sinib,
          kartani buzardi. Ixcham ko'rinish ("2,3 mlrd") o'qilarli qoladi,
          to'liq raqam esa `title` da — sichqoncha ustiga kelganda chiqadi. */}
      <Card className="p-3 sm:p-4">
        <p className="text-muted text-xs sm:text-sm mb-1">Ombor qiymati</p>
        <p
          className="text-xl sm:text-2xl font-bold text-fg tnum"
          title={formatSomLabel(kpi.omborQiymati)}
        >
          {formatMoneyCompact(kpi.omborQiymati)}{" "}
          <span className="text-sm sm:text-base font-medium text-muted">so&apos;m</span>
        </p>
        <p className="text-2xs text-muted mt-1">tannarx bo&apos;yicha</p>
      </Card>

      <Card className="p-3 sm:p-4">
        <p className="text-muted text-xs sm:text-sm mb-1">Kam qolgan</p>
        <p
          className={`text-xl sm:text-2xl font-bold tnum ${
            kpi.kamQolgan > 0 ? "text-debt" : "text-fg"
          }`}
        >
          {kpi.kamQolgan} <span className="text-sm sm:text-base font-medium text-muted">ta</span>
        </p>
        {kpi.tugagan > 0 && (
          <p className="text-2xs text-expense mt-1">{kpi.tugagan} ta tugagan</p>
        )}
      </Card>
    </div>
  );
}
