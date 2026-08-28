"use client";

import { formatMoneyCompact, formatSomLabel } from "@/lib/format";
import { YAQIN_MUDDAT_KUN } from "@/lib/qarzMuddat";
import type { QarzDashboardDTO } from "@/lib/queries/qarz";
import type { QarzTezFiltr } from "./QarzFiltrPanel";

/**
 * QARZLAR DASHBOARDI.
 *
 * Raqamlar SERVERDA jamlanadi (lib/queries/qarz.ts): ro'yxat chegaralangan,
 * minglab qarzi bor biznesda brauzerda jamlash yolg'on natija berardi.
 *
 * HAR KARTA BOSILADI (2-talab): karta faqat raqam ko'rsatmaydi — u
 * tegishli filtrga OLIB BORADI. "Muddati o'tgan 1,7 mln" ni ko'rgan odam
 * darhol "kim?" deb so'raydi; javob bir bosish narida turishi kerak.
 *
 * "Menga qarzdor" va "Men qarzdorman" ATAYLAB aralashtirilmaydi (26-talab):
 * birinchisi biznesning aktivi, ikkinchisi majburiyati. Ikkalasini bitta
 * "jami qarzdorlik" raqamiga qo'shish hisobni yolg'onga aylantirardi.
 */
export function QarzKPI({
  d,
  faol,
  onTanla,
  yonalish,
}: {
  d: QarzDashboardDTO;
  /** Hozir qaysi tez filtr yoqilgan — karta shunga qarab belgilanadi. */
  faol: QarzTezFiltr;
  onTanla: (f: QarzTezFiltr) => void;
  /** "beriladigan" bo'lsa kartalar "men qarzdorman" tilida yoziladi. */
  yonalish: "olinadigan" | "beriladigan";
}) {
  const beriladigan = yonalish === "beriladigan";

  const kartalar: {
    kod: QarzTezFiltr;
    label: string;
    qiymat: number;
    cls: string;
    izoh: string;
  }[] = beriladigan
    ? [
        {
          kod: "hammasi",
          label: "Jami majburiyat",
          qiymat: d.beriladiganJami,
          cls: "text-expense",
          izoh: `${d.beriladiganSoni} ta kreditor · to'lanishi kerak`,
        },
        {
          kod: "bugun-tolangan",
          label: "Bugun to'ladim",
          qiymat: d.bugunTolaganim,
          cls: "text-fg",
          izoh: "Bugun kassadan chiqqan qarz to'lovi",
        },
        {
          kod: "kechikdi",
          label: "Muddati o'tgan",
          qiymat: d.beriladiganMuddatiOtgan,
          cls: "text-expense",
          izoh: "Kelishilgan muddat o'tib ketgan majburiyat",
        },
      ]
    : [
        {
          kod: "hammasi",
          label: "Jami qarzdorlik",
          qiymat: d.ochiqJami,
          cls: "text-debt",
          izoh: `${d.mijozlarSoni} ta qarzdor · kelishi kerak bo'lgan pul`,
        },
        {
          kod: "bugun-berilgan",
          label: "Bugun berilgan",
          qiymat: d.bugunBerilgan,
          cls: "text-fg",
          izoh: "Bugun qarzga yozilgan savdo",
        },
        {
          kod: "bugun-tolangan",
          label: "Bugun to'langan",
          qiymat: d.bugunYopilgan,
          cls: "text-income",
          izoh: "Bugun qabul qilingan to'lovlar",
        },
        {
          kod: "kechikdi",
          label: "Muddati o'tgan",
          qiymat: d.muddatiOtgan,
          cls: "text-expense",
          izoh: `${d.muddatiOtganSoni} ta qarzdor kechiktirgan`,
        },
        {
          kod: "yaqin",
          label: "Yaqin muddatli",
          qiymat: d.yaqinMuddatli,
          cls: "text-warning",
          izoh: `${YAQIN_MUDDAT_KUN} kun ichida to'lanishi kerak`,
        },
      ];

  // MOBIL: kartalar gorizontal SURILADIGAN lenta bo'ladi, panjara emas.
  // Beshta kartani 375px da 2 ustunga tersak uch qator chiqib, qarzdorlar
  // ro'yxati ekrandan tushib ketardi — telefonda esa asosiy ish aynan
  // ro'yxatda. Surish faqat SHU quti ichida (`jadval-siljish`), sahifaning
  // o'zi gorizontal surilmaydi.
  return (
    <div
      className={`flex gap-2 jadval-siljish pb-1 snap-x snap-mandatory lg:grid lg:gap-3 lg:pb-0 lg:overflow-visible ${
        beriladigan ? "lg:grid-cols-3" : "lg:grid-cols-5"
      }`}
    >
      {kartalar.map((k) => {
        const tanlangan = faol === k.kod;
        // "Bugun berilgan" ro'yxat filtri emas — u qarz YARATILISH kesimi,
        // qarzdorlar ro'yxatida mos filtr yo'q. Shuning uchun u oddiy karta.
        const bosiladi = k.kod !== "bugun-berilgan" && k.kod !== "bugun-tolangan";
        const Umumiy = (
          <>
            <p className="text-muted text-xs sm:text-sm mb-1 truncate">{k.label}</p>
            <p
              className={`text-lg sm:text-xl font-semibold tnum ${k.cls}`}
              title={formatSomLabel(k.qiymat)}
            >
              {formatMoneyCompact(k.qiymat)}
            </p>
            <p className="text-2xs text-faint mt-1 line-clamp-2">{k.izoh}</p>
          </>
        );

        if (!bosiladi) {
          return (
            <div
              key={k.kod}
              className="shrink-0 snap-start w-[9.5rem] lg:w-auto bg-surface rounded-2xl shadow-card border border-line p-3 sm:p-4"
            >
              {Umumiy}
            </div>
          );
        }
        return (
          <button
            key={k.kod}
            type="button"
            onClick={() => onTanla(tanlangan ? "hammasi" : k.kod)}
            aria-pressed={tanlangan}
            className={`shrink-0 snap-start w-[9.5rem] lg:w-auto text-left bg-surface rounded-2xl shadow-card border p-3 sm:p-4 min-h-[44px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              tanlangan ? "border-brand ring-1 ring-brand" : "border-line hover:border-brand"
            }`}
          >
            {Umumiy}
          </button>
        );
      })}
    </div>
  );
}
