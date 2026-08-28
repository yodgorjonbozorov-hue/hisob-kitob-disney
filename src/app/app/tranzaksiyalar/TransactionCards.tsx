"use client";

import { Money } from "@/components/ui/Money";
import { formatDateUz, formatRelativeDay, formatSom } from "@/lib/format";
import { formatKgLabel } from "@/lib/kg";
import { AmalMenu } from "./AmalMenu";
import { tolovYorligi } from "./turlar";
import type { TransactionDTO } from "@/lib/queries/transactions";

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

function kunKaliti(sana: Date): string {
  return new Date(sana.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * MOBIL RO'YXAT — jadval EMAS, kartalar.
 *
 * 375px telefonda sakkiz ustunli jadvalni yon tomonga siljitib ko'rsatish
 * ma'lumotni yashirish bilan teng: foydalanuvchi summani ko'rish uchun
 * har qatorni surishi kerak bo'lardi. Karta esa muhimini (kategoriya va
 * summa) bir qatorda beradi, qolganini pastida.
 *
 * Kunlar bo'yicha guruhlanadi va kun sarlavhasi yopishqoq — uzun ro'yxatda
 * "qaysi kunni ko'rayapman" degan savol tug'ilmaydi. Kun sof natijasi
 * SAHIFADAGI yozuvlardan hisoblanadi va shu tarzda belgilanadi.
 */
export function TransactionCards({
  items,
  onBatafsil,
  onTahrirlash,
  onOchirish,
  ozgartirsaBoladi,
  kategoriyaniYashir = false,
}: {
  items: TransactionDTO[];
  onBatafsil: (t: TransactionDTO) => void;
  onTahrirlash: (t: TransactionDTO) => void;
  onOchirish: (t: TransactionDTO) => void;
  ozgartirsaBoladi: (t: TransactionDTO) => boolean;
  /**
   * Kategoriya kesimi ichida: qatorda kategoriya nomini QAYTA yozmaymiz —
   * u yuqoridagi ochilgan sarlavhada turibdi. O'rniga izoh bosh qator
   * bo'ladi, ya'ni har qator yangi ma'lumot beradi.
   */
  kategoriyaniYashir?: boolean;
}) {
  const guruhlar: { kalit: string; sana: Date; items: TransactionDTO[]; sof: number }[] = [];
  for (const t of items) {
    const sana = new Date(t.sana);
    const kalit = kunKaliti(sana);
    let g = guruhlar.find((x) => x.kalit === kalit);
    if (!g) {
      g = { kalit, sana, items: [], sof: 0 };
      guruhlar.push(g);
    }
    g.items.push(t);
    g.sof += t.turi === "kirim" ? t.summa : -t.summa;
  }

  // `lg:hidden` BU YERDA emas, chaqiruvchida: tekis ro'yxatda kartalar faqat
  // telefonda ko'rinadi (desktopda jadval), kategoriya ichida esa HAR
  // o'lchamda — u yerda jadval ustunlari ortiqcha shovqin bo'lardi.
  return (
    <div>
      {guruhlar.map((g) => (
        <div key={g.kalit}>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-2
            bg-surface-2/95 backdrop-blur border-y border-line">
            <span className="text-sm font-medium text-fg">{formatRelativeDay(g.sana)}</span>
            <span className="text-2xs text-muted tnum">
              Kun sofi: <Money value={g.sof} size="sm" signed suffix={false} />
            </span>
          </div>
          <ul className="divide-y divide-line">
            {g.items.map((t) => (
              <li key={t.id} className="flex items-stretch gap-1 px-2 py-1">
                <Karta t={t} onBatafsil={() => onBatafsil(t)} kategoriyaniYashir={kategoriyaniYashir} />
                <div className="self-center">
                  <AmalMenu
                    onBatafsil={() => onBatafsil(t)}
                    onTahrirlash={ozgartirsaBoladi(t) ? () => onTahrirlash(t) : undefined}
                    onOchirish={ozgartirsaBoladi(t) ? () => onOchirish(t) : undefined}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Karta({
  t,
  onBatafsil,
  kategoriyaniYashir,
}: {
  t: TransactionDTO;
  onBatafsil: () => void;
  kategoriyaniYashir: boolean;
}) {
  const kirim = t.turi === "kirim";
  return (
    <button
      type="button"
      onClick={onBatafsil}
      className="flex-1 min-w-0 text-left px-2 py-2.5 rounded-lg active:bg-surface-2 transition"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium ${
              kirim ? "bg-income-soft text-income-fg" : "bg-expense-soft text-expense-fg"
            }`}
          >
            <span aria-hidden="true">{kirim ? "↓" : "↑"}</span>
            {kirim ? "Kirim" : "Chiqim"}
          </span>
          <span className="block mt-1 font-medium text-fg truncate">
            {kategoriyaniYashir ? (t.izoh ?? "Izohsiz") : t.category.nomi}
          </span>
        </span>
        <span
          className={`font-display tnum font-semibold whitespace-nowrap ${
            kirim ? "text-income" : "text-expense"
          }`}
        >
          {kirim ? "+" : "−"} {formatSom(t.summa)}
        </span>
      </div>

      <span className="mt-1 block text-2xs text-muted truncate">
        {tolovYorligi(t)} · {formatDateUz(new Date(t.sana))} · {t.user.ism}
      </span>

      {/* Kg savdosida "100 kg × 5 000" tarixda YO'QOLMAYDI. */}
      {t.miqdorGr != null && t.kgNarxi != null && (
        <span className="block text-2xs text-muted tnum truncate">
          {formatKgLabel(t.miqdorGr)} × {formatSom(t.kgNarxi)} soʻm
        </span>
      )}

      {/* Kategoriya yashirilganda izoh allaqachon bosh qatorda — takrorlanmaydi. */}
      {!kategoriyaniYashir && (t.izoh || t.crmBuyurtma) && (
        <span className="block text-2xs text-faint truncate">
          {t.crmBuyurtma ? "CRM · " : ""}
          {t.izoh ?? t.crmBuyurtma?.nomi ?? ""}
        </span>
      )}
      {kategoriyaniYashir && t.crmBuyurtma && (
        <span className="block text-2xs text-faint truncate">CRM · {t.crmBuyurtma.nomi}</span>
      )}
    </button>
  );
}
