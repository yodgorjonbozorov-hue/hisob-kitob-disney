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
 * Endi oyna ochiq turadi, tanlanganlar pastda sanaladi va hammasi birdan
 * savatga qo'shiladi.
 *
 * TARTIB — `lib/mahsulotTartib.ts`: qoldig'i ko'pi tepada, tugagani eng
 * pastda. Qidiruv ro'yxatni faqat FILTRLAYDI, tartibni o'zgartirmaydi.
 *
 * QOLDIQ CHEGARASI shu yerda ham qo'yiladi (`max`), lekin u faqat
 * qulaylik: haqiqiy tekshiruv serverda, atomik `miqdor: { gte }` sharti
 * bilan (lib/services/inventory.ts).
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

  const royxat = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    const tartiblangan = mahsulotlarniTartibla(
      products.map((p) => ({ ...p, qoldiq: p.qoldiq }))
    );
    if (!q) return tartiblangan;
    return tartiblangan.filter(
      (p) => p.nomi.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [products, qidiruv]);

  /** Shu mahsulotdan yana nechtasini qo'shish mumkin (savatdagisi ayrilgan). */
  function qolganChegara(p: ProductKassirDTO): number {
    return Math.max(0, p.qoldiq - (savatda[p.id] ?? 0));
  }

  function ozgart(p: ProductKassirDTO, xom: number) {
    const chegara = qolganChegara(p);
    const miqdor = Math.max(0, Math.min(avto ? Math.min(1, chegara) : chegara, xom));
    setTanlov((t) => {
      const yangi = { ...t };
      if (miqdor <= 0) delete yangi[p.id];
      else yangi[p.id] = miqdor;
      return yangi;
    });
  }

  const tanlanganlar = Object.entries(tanlov);
  const jamiDona = tanlanganlar.reduce((s, [, m]) => s + m, 0);

  function qoshish() {
    onQoshish(tanlanganlar.map(([productId, miqdor]) => ({ productId, miqdor })));
    setTanlov({});
    setQidiruv("");
    onClose();
  }

  return (
    <Modal open={ochiq} onClose={onClose} title="Mahsulot tanlash" size="lg">
      <div className="space-y-3">
        <input
          type="text"
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder="Nomi yoki SKU bo'yicha qidiring..."
          className={INPUT_CLASS}
          autoComplete="off"
        />

        <ul className="max-h-[52vh] overflow-y-auto divide-y divide-line rounded-xl border border-line">
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
                className={`flex items-center gap-3 px-3 py-2.5 ${band ? "opacity-55" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-fg truncate">{p.nomi}</p>
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
                  <span className="shrink-0 text-2xs text-faint">
                    {tugadi ? "—" : "savatda"}
                  </span>
                ) : (
                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`${p.nomi} miqdorini kamaytirish`}
                      onClick={() => ozgart(p, miqdor - 1)}
                      className="w-9 h-9 rounded-lg border border-line text-fg disabled:opacity-40"
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
                      onChange={(e) => ozgart(p, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
                      className="w-12 h-9 rounded-lg border border-line bg-surface text-center text-sm tnum"
                    />
                    <button
                      type="button"
                      aria-label={`${p.nomi} miqdorini oshirish`}
                      onClick={() => ozgart(p, miqdor + 1)}
                      className="w-9 h-9 rounded-lg border border-line text-fg disabled:opacity-40"
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

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-sm text-muted">
            {tanlanganlar.length > 0
              ? `${tanlanganlar.length} ta mahsulot · ${jamiDona} birlik`
              : "Hech narsa tanlanmadi"}
          </p>
          <Button onClick={qoshish} disabled={tanlanganlar.length === 0}>
            Savatga qo&apos;shish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
