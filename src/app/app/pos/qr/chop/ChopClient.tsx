"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  YORLIQ_OLCHAMLARI,
  STANDART_YORLIQ,
  yorliqByCode,
  MAKS_YORLIQ,
} from "@/lib/magazin/yorliq";

export interface Yorliq {
  id: string;
  nomi: string;
  kod: string;
  /** Serverda chizilgan QR (SVG matni). */
  svg: string;
}

/**
 * YORLIQ CHOP ETISH — termal stiker printeri uchun.
 *
 * ASOSIY QOIDA: har yorliq ALOHIDA SAHIFA. Termal printer rulondan bittalab
 * yorliq beradi va sahifa o'lchami yorliq o'lchamiga TENG bo'lishi shart.
 * A4 ga bir nechta stiker joylash bu printerda qog'ozni noto'g'ri uzishga
 * olib keladi.
 *
 * Shu bois `@page { size: <keng>mm <baland>mm; margin: 0 }` va har yorliqdan
 * keyin `page-break-after: always`.
 */
export function ChopClient({
  yorliqlar,
  biznesNomi,
  jamiQrli,
  kodsizSoni,
}: {
  yorliqlar: Yorliq[];
  biznesNomi: string;
  /** QR biriktirilgan jami tovar (chegaradan oshgani ham hisobga olinadi). */
  jamiQrli: number;
  /** Hali hech qanday kodi yo'q tovarlar soni. */
  kodsizSoni: number;
}) {
  const [olchamKodi, setOlchamKodi] = useState(STANDART_YORLIQ);
  const [tanlangan, setTanlangan] = useState<Set<string>>(
    () => new Set(yorliqlar.map((y) => y.id))
  );

  const olcham = yorliqByCode(olchamKodi);
  const chopEtiladi = useMemo(
    () => yorliqlar.filter((y) => tanlangan.has(y.id)),
    [yorliqlar, tanlangan]
  );

  function almashtir(id: string) {
    setTanlangan((prev) => {
      const y = new Set(prev);
      if (y.has(id)) y.delete(id);
      else y.add(id);
      return y;
    });
  }

  const css = `
    .yorliq {
      width: ${olcham.kengMm}mm;
      height: ${olcham.balandMm}mm;
      box-sizing: border-box;
      padding: 1mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.6mm;
      background: #fff;
      color: #000;
      overflow: hidden;
    }
    .yorliq-qr { width: ${olcham.qrMm}mm; height: ${olcham.qrMm}mm; flex: none; }
    .yorliq-qr svg { width: 100%; height: 100%; display: block; }
    .yorliq-nom {
      font-size: ${olcham.nomPt}pt;
      line-height: 1.15;
      text-align: center;
      max-width: 100%;
      /* Uzun nom yorliqdan chiqib ketmasin — ikki qatorga kesiladi. */
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .yorliq-kod {
      font-family: ui-monospace, monospace;
      font-size: ${olcham.kodPt}pt;
      line-height: 1;
      white-space: nowrap;
    }

    /* Ekranda — ko'rib chiqish uchun to'r. */
    @media screen {
      .yorliqlar { display: flex; flex-wrap: wrap; gap: 8px; }
      .yorliq { border: 1px dashed #d4d4d4; }
    }

    /* Chop etishda — har yorliq ALOHIDA sahifa, sahifa o'lchami = yorliq. */
    @media print {
      @page { size: ${olcham.kengMm}mm ${olcham.balandMm}mm; margin: 0; }
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      /* Ilova qobig'i (menyu, sarlavha, tugmalar) chop etilmaydi. */
      .chop-yashir, header, nav, aside, footer { display: none !important; }
      .yorliqlar { display: block; }
      .yorliq { border: none; page-break-after: always; break-after: page; }
      .yorliq:last-child { page-break-after: auto; break-after: auto; }
    }
  `;

  return (
    <div className="space-y-5">
      {/* --- Boshqaruv (chop etishda ko'rinmaydi) --- */}
      <div className="chop-yashir space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Yorliqlarni chop etish</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{biznesNomi}</span> · QR biriktirilgan{" "}
            {jamiQrli} ta tovar
          </p>
        </div>

        {kodsizSoni > 0 && (
          <Card>
            <p className="text-sm text-fg">
              Yana <span className="font-semibold">{kodsizSoni}</span> ta tovarda hech qanday kod
              yo&apos;q — ular bu ro&apos;yxatga kirmagan.
            </p>
            <p className="text-xs text-muted mt-1">
              QR / Shtrix-kod bo&apos;limidagi &quot;Kodsiz tovarlarga QR yaratish&quot; tugmasi
              bilan hammasiga bir yo&apos;la QR yarating, so&apos;ng shu yerga qayting.
            </p>
            <Link href="/app/pos/qr" className="inline-block mt-3">
              <Button variant="secondary" size="sm">
                QR / Shtrix-kod bo&apos;limiga
              </Button>
            </Link>
          </Card>
        )}

        <Card>
          <label className="block text-sm font-medium text-fg mb-2">Yorliq o&apos;lchami</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {YORLIQ_OLCHAMLARI.map((y) => (
              <button
                key={y.code}
                onClick={() => setOlchamKodi(y.code)}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  olchamKodi === y.code
                    ? "border-brand bg-brand-wash text-brand font-medium"
                    : "border-line text-muted"
                }`}
              >
                {y.nomi}
              </button>
            ))}
          </div>
          <p className="text-xs text-faint mt-3">
            Printer sozlamasida ham shu o&apos;lcham turishi kerak. Chop etish oynasida
            &quot;Margins: None&quot; va &quot;Scale: 100%&quot; ni tanlang — aks holda QR
            kichrayib skanerlanmay qoladi.
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-fg">
              <span className="font-semibold">{chopEtiladi.length}</span> ta yorliq tanlangan
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTanlangan(new Set(yorliqlar.map((y) => y.id)))}
              >
                Hammasini tanlash
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setTanlangan(new Set())}>
                Tanlovni bekor qilish
              </Button>
              <Button onClick={() => window.print()} disabled={chopEtiladi.length === 0}>
                Chop etish
              </Button>
            </div>
          </div>

          {yorliqlar.length >= MAKS_YORLIQ && (
            <p className="text-xs text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2 mt-3">
              Bir yurishda {MAKS_YORLIQ} tadan ko&apos;p yorliq chop etilmaydi (brauzer chop etish
              oynasi qotib qoladi). Birinchi {MAKS_YORLIQ} tasi ko&apos;rsatildi — ularni chop
              etib bo&apos;lgach sahifani yangilang.
            </p>
          )}

          <div className="mt-4 max-h-72 overflow-y-auto divide-y divide-line">
            {yorliqlar.map((y) => (
              <label key={y.id} className="flex items-center gap-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tanlangan.has(y.id)}
                  onChange={() => almashtir(y.id)}
                />
                <span className="text-sm text-fg truncate flex-1">{y.nomi}</span>
                <span className="text-2xs text-faint font-mono shrink-0">{y.kod}</span>
              </label>
            ))}
          </div>
        </Card>
      </div>

      {/* --- Yorliqlar: ekranda ko'rinish, chop etishda haqiqiy sahifalar --- */}
      <div className="yorliqlar">
        {chopEtiladi.map((y) => (
          <div key={y.id} className="yorliq">
            <div className="yorliq-qr" dangerouslySetInnerHTML={{ __html: y.svg }} />
            {olcham.nomPt > 0 && <div className="yorliq-nom">{y.nomi}</div>}
            <div className="yorliq-kod">{y.kod}</div>
          </div>
        ))}
      </div>

      {/*
        Dinamik CSS: `@page` o'lchami va mm birliklari Tailwind bilan
        ifodalab bo'lmaydi, tanlangan yorliqqa qarab o'zgaradi. Loyihada
        `styled-jsx` boshqa joyda ishlatilmagani uchun oddiy <style> tegi —
        yangi uslub olib kirilmaydi. Matn butunlay shu komponentda
        hosil qilinadi (foydalanuvchi kiritmasi emas).
      */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </div>
  );
}
