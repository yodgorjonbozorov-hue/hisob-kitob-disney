"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSom, formatSomLabel, formatDateUz } from "@/lib/format";
import { HOLAT_BELGI, HOLAT_NOMI } from "@/lib/omborHolat";
import type { MahsulotDetalDTO, HarakatDTO } from "@/lib/queries/ombor";

const HARAKAT_NOMI: Record<string, string> = {
  taminot: "Ta'minot",
  sotuv: "Sotuv",
  chiqarish: "Hisobdan chiqarish",
  inventarizatsiya: "Qoldiqni to'g'rilash",
  taminot_bekor: "Ta'minot bekor qilindi",
};

/**
 * MAHSULOT TAFSILOTI — kartochka bosilganda.
 *
 * Bu yerda kartochkada ko'rsatilmagan hamma narsa bor: tannarx, ombordagi
 * qiymati, SKU va — eng muhimi — HARAKATLAR TARIXI. "Qoldiq nega 475 ta?"
 * degan savolga jadval emas, vaqt chizig'i javob beradi: +500 ta'minot,
 * −20 sotuv, −5 hisobdan chiqarish.
 */
export function MahsulotDetal({
  productId,
  onClose,
  onTovarKeldi,
  onTahrirla,
}: {
  productId: string;
  onClose: () => void;
  onTovarKeldi: () => void;
  onTahrirla: (m: MahsulotDetalDTO) => void;
}) {
  const [m, setM] = useState<MahsulotDetalDTO | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  useEffect(() => {
    let bekor = false;
    fetch(`/api/ombor/mahsulotlar/${productId}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (bekor) return;
        if (!r.ok) setXato(d.error ?? "Mahsulotni yuklab bo'lmadi");
        else setM(d);
      })
      .catch(() => !bekor && setXato("Tarmoq xatosi"));
    return () => {
      bekor = true;
    };
  }, [productId]);

  return (
    <Modal open onClose={onClose} title={m?.nomi ?? "Mahsulot"} size="lg">
      {xato && <p className="text-sm text-expense py-4">{xato}</p>}
      {!m && !xato && <p className="text-sm text-faint py-8 text-center">Yuklanmoqda...</p>}

      {m && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-24 h-24 shrink-0 rounded-xl bg-surface-2 overflow-hidden flex items-center justify-center">
              {m.rasmUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.rasmUrl} alt={m.nomi} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl text-faint" aria-hidden>
                  &#128230;
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              {m.kategoriyaNomi && <p className="text-xs text-muted">{m.kategoriyaNomi}</p>}
              <p className="text-xl font-bold text-fg tnum">
                {formatSom(m.miqdor)} <span className="text-sm font-medium text-muted">{m.birlik}</span>
              </p>
              <p className="text-sm">
                {HOLAT_BELGI[m.holat]}{" "}
                <span
                  className={
                    m.holat === "tugagan"
                      ? "text-expense"
                      : m.holat === "kam"
                        ? "text-debt"
                        : "text-income"
                  }
                >
                  {HOLAT_NOMI[m.holat]}
                </span>
              </p>
              {m.sku && <p className="text-2xs text-faint">Kod: {m.sku}</p>}
            </div>
          </div>

          <div className="rounded-xl border border-line divide-y divide-line">
            <Qator nomi="Tannarx" qiymat={formatSomLabel(m.kelganNarx)} />
            <Qator
              nomi="Sotuv narxi"
              qiymat={m.sotuvNarx > 0 ? formatSomLabel(m.sotuvNarx) : "qo'yilmagan"}
            />
            <Qator nomi="Ombordagi qiymati" qiymat={formatSomLabel(m.qiymat)} />
            {m.minQoldiq > 0 && (
              <Qator nomi="Minimal qoldiq" qiymat={`${formatSom(m.minQoldiq)} ${m.birlik}`} />
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={onTovarKeldi} className="flex-1">
              Tovar keldi
            </Button>
            <Button variant="secondary" onClick={() => onTahrirla(m)} className="flex-1">
              Tahrirlash
            </Button>
          </div>

          <div>
            <p className="font-medium text-fg mb-2">Harakatlar</p>
            {m.harakatlar.length === 0 ? (
              <p className="text-sm text-faint py-3">Hali harakat yo&apos;q.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {m.harakatlar.map((h) => (
                  <HarakatQatori key={h.id} h={h} birlik={m.birlik} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function HarakatQatori({ h, birlik }: { h: HarakatDTO; birlik: string }) {
  const musbat = h.farq > 0;
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-fg">{HARAKAT_NOMI[h.turi] ?? h.turi}</p>
        <p className="text-2xs text-muted">
          {formatDateUz(new Date(h.sana))}
          {h.izoh ? ` · ${h.izoh}` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold tnum ${musbat ? "text-income" : "text-expense"}`}>
          {musbat ? "+" : ""}
          {formatSom(h.farq)} {birlik}
        </p>
        {h.birlikNarx != null && h.birlikNarx > 0 && (
          <p className="text-2xs text-muted tnum">{formatSomLabel(h.birlikNarx)}</p>
        )}
      </div>
    </li>
  );
}

function Qator({ nomi, qiymat }: { nomi: string; qiymat: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <span className="text-sm text-muted">{nomi}</span>
      <span className="text-sm font-medium text-fg tnum">{qiymat}</span>
    </div>
  );
}
