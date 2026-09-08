"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSomLabel } from "@/lib/format";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import { mahsulotlarniTartibla, tugaganmi } from "@/lib/mahsulotTartib";
import type { ProductKassirDTO } from "@/lib/queries/inventory";

/**
 * KO'P MAHSULOTLI TANLOV — bitta oynada 5-6 tasi (yoki ko'proq) tanlanadi.
 *
 * Ilgari har mahsulot uchun oynani qaytadan ochish kerak edi: mijoz
 * tanlangach 6 ta tovar sotish 6 marta oyna ochib-yopishni talab qilardi.
 * Endi oyna OCHIQ TURADI: foydalanuvchi belgilaydi, miqdorini kiritadi,
 * pastdagi ro'yxatda tanlaganini KO'RIB CHIQADI va bitta tugma bilan
 * hammasini savatga qo'shadi.
 *
 * TARTIB — `lib/mahsulotTartib.ts`: qoldig'i ko'pi tepada, tugagani eng
 * pastda. Qidiruv ro'yxatni faqat FILTRLAYDI, tartibni o'zgartirmaydi.
 *
 * QOLDIQ CHEGARASI shu yerda ham qo'yiladi (`+` tugmasi o'chadi), lekin u
 * faqat qulaylik: haqiqiy tekshiruv serverda, atomik `miqdor: { gte }`
 * sharti bilan (lib/services/inventory.ts).
 */
export function MahsulotTanlashModal({
  ochiq,
  onClose,
  products,
  /** Savatda allaqachon turgan miqdorlar — qolgan chegara shundan hisoblanadi. */
  savatda,
  onQoshish,
  avto,
}: {
  ochiq: boolean;
  onClose: () => void;
  products: ProductKassirDTO[];
  savatda: Record<string, number>;
  onQoshish: (tanlov: { productId: string; miqdor: number }[]) => void;
  avto: boolean;
}) {
  const [qidiruv, setQidiruv] = useState("");
  const [tanlov, setTanlov] = useState<Record<string, number>>({});

  const tartiblangan = useMemo(() => mahsulotlarniTartibla(products), [products]);
  const royxat = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    if (!q) return tartiblangan;
    return tartiblangan.filter(
      (p) => p.nomi.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [tartiblangan, qidiruv]);

  /** Shu mahsulotdan yana nechtasini qo'shish mumkin (savatdagisi ayrilgan). */
  function qolganChegara(p: ProductKassirDTO): number {
    return Math.max(0, p.qoldiq - (savatda[p.id] ?? 0));
  }

  function ozgart(p: ProductKassirDTO, xom: number) {
    const chegara = avto ? Math.min(1, qolganChegara(p)) : qolganChegara(p);
    const miqdor = Math.max(0, Math.min(chegara, xom));
    setTanlov((t) => {
      const yangi = { ...t };
      if (miqdor <= 0) delete yangi[p.id];
      else yangi[p.id] = miqdor;
      return yangi;
    });
  }

  const tanlanganlar = Object.entries(tanlov);
  const jamiDona = tanlanganlar.reduce((s, [, m]) => s + m, 0);
  const jamiSumma = tanlanganlar.reduce((s, [id, m]) => {
    const p = products.find((x) => x.id === id);
    return s + (p?.sotuvNarx ?? 0) * m;
  }, 0);

  function qoshish() {
    onQoshish(tanlanganlar.map(([productId, miqdor]) => ({ productId, miqdor })));
    setTanlov({});
    setQidiruv("");
    onClose();
  }

  return (
    <Modal open={ochiq} onClose={onClose} title="Mahsulot tanlash" size="lg">
      <div className="space-y-3" data-test="mahsulot-tanlash">
        <input
          type="text"
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder="Nomi yoki SKU bo'yicha qidiring..."
          className={INPUT_CLASS}
          autoComplete="off"
          aria-label="Mahsulot qidirish"
        />

        <ul
          className="max-h-[42vh] sm:max-h-[46vh] overflow-y-auto overscroll-contain divide-y divide-line rounded-xl border border-line"
          data-test="mahsulot-royxati"
        >
          {royxat.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-faint">Mahsulot topilmadi</li>
          )}
          {royxat.map((p) => {
            const chegara = qolganChegara(p);
            const tugadi = tugaganmi(p.qoldiq);
            const band = chegara <= 0;
            const miqdor = tanlov[p.id] ?? 0;
            return (
              <li
                key={p.id}
                data-test="mahsulot-qator"
                data-nomi={p.nomi}
                /* Mobil'da nom va stepper bir qatorga sig'masa stepper pastga
                   tushadi (`flex-wrap`) — 375px ekranda ham bosiladigan
                   qoladi. */
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${
                  band ? "opacity-55" : ""
                }`}
              >
                <div className="min-w-[55%] flex-1">
                  <p className="text-sm text-fg">{p.nomi}</p>
                  <p className="text-2xs text-muted">
                    {p.sotuvNarx > 0 ? formatSomLabel(p.sotuvNarx) : "narx kelishiladi"}
                    {tugadi ? (
                      <span className="text-expense"> · {avto ? "Sotilgan" : "Qolmadi"}</span>
                    ) : (
                      <span className="text-faint">
                        {" "}
                        · qoldiq {p.qoldiq} {p.birlik}
                        {savatda[p.id] ? ` (savatda ${savatda[p.id]})` : ""}
                      </span>
                    )}
                  </p>
                </div>

                {/* Tugagan mahsulotni tanlab bo'lmaydi — stepper umuman
                    ko'rsatilmaydi, "Qolmadi" belgisi esa qoladi. */}
                {band ? (
                  <span className="ml-auto shrink-0 text-2xs text-faint">
                    {tugadi ? "—" : "savatda"}
                  </span>
                ) : (
                  <div className="ml-auto shrink-0 flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`${p.nomi} miqdorini kamaytirish`}
                      onClick={() => ozgart(p, miqdor - 1)}
                      className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg border border-line text-fg disabled:opacity-40"
                      disabled={miqdor <= 0}
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`${p.nomi} miqdori`}
                      value={miqdor || ""}
                      placeholder="0"
                      onChange={(e) =>
                        ozgart(p, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
                      }
                      className="w-12 h-11 sm:h-9 rounded-lg border border-line bg-surface text-center text-sm tnum"
                    />
                    <button
                      type="button"
                      aria-label={`${p.nomi} miqdorini oshirish`}
                      onClick={() => ozgart(p, miqdor + 1)}
                      className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg border border-line text-fg disabled:opacity-40"
                      disabled={miqdor >= chegara}
                    >
                      +
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* TANLANGANLARNI KO'RIB CHIQISH — qo'shishdan OLDIN. Ro'yxat uzun
            bo'lsa foydalanuvchi yuqoriga qaytmasdan nimani tanlaganini
            ko'radi va shu yerdan olib tashlay oladi. */}
        {tanlanganlar.length > 0 && (
          <div className="rounded-xl border border-brand/30 bg-brand-wash px-3 py-2.5" data-test="tanlanganlar">
            <p className="text-2xs font-medium text-muted mb-1.5">
              Tanlangan: {tanlanganlar.length} ta mahsulot · {jamiDona} birlik
              {jamiSumma > 0 && ` · ${formatSomLabel(jamiSumma)}`}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {tanlanganlar.map(([id, m]) => {
                const p = products.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => ozgart(p, 0)}
                      aria-label={`${p.nomi} tanlovini bekor qilish`}
                      className="inline-flex items-center gap-1 rounded-lg bg-surface border border-line px-2 py-1 text-2xs text-fg"
                    >
                      <span className="max-w-[9rem] truncate">{p.nomi}</span>
                      <span className="tnum text-muted">× {m}</span>
                      <span className="text-faint">×</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Tugma pastda yopishqoq: uzun ro'yxatda ham barmoq ostida qoladi. */}
        <div className="sticky bottom-0 -mx-4 px-4 sm:mx-0 sm:px-0 bg-surface pt-2 pb-1 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {tanlanganlar.length > 0 ? `${jamiDona} birlik` : "Hech narsa tanlanmadi"}
          </p>
          <Button onClick={qoshish} disabled={tanlanganlar.length === 0} data-test="savatga-qoshish">
            Savatga qo&apos;shish{tanlanganlar.length > 0 ? ` (${tanlanganlar.length})` : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
