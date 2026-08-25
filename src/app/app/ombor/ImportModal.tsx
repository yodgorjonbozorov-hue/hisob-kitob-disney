"use client";

import { type ChangeEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSom } from "@/lib/format";
import { ImportNatija } from "./ImportNatija";
import { useImportOqimi } from "./useImportOqimi";

export type { Natija } from "./importYuborish";

const NAMUNA_CSV = `Nomi,SKU,Shtrix kod,Kategoriya,Birlik,Tannarx,Sotuv narxi,Qoldiq,Min qoldiq,Izoh
Coca-Cola 1L,,4601234567890,Ichimlik,dona,9000,12000,48,10,
Shar 12 dyuym,SH-012,,Sharlar,dona,1500,4000,200,20,`;

/**
 * KATALOG IMPORTI — ikki bosqichli.
 *
 * Avval fayl tekshiriladi va natija ko'rsatiladi (nechta tovar, qaysi
 * ustunlar tanildi, nechta xato, narxsiz/qoldiqsiz nechta). Foydalanuvchi
 * ko'rgandan keyingina yozadi: yuzlab tovarni ko'r-ko'rona qo'shib yuborish
 * xavfi yo'q. Rasmli katta Excel brauzerda ochiladi — oqim `useImportOqimi`.
 */
export function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const oqim = useImportOqimi(onDone);
  const { fayl, rejim, setRejim, tekshiruv, natija, loading, xato, bosqich } = oqim;

  function faylTanlandi(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void oqim.faylTanlandi(f);
  }

  function namunaYuklab() {
    const blob = new Blob(["﻿" + NAMUNA_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "balansa-mahsulot-namuna.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (natija) {
    return <ImportNatija natija={natija} rasmXabar={oqim.rasmXabar} onClose={onClose} />;
  }

  const rasmSoni = oqim.rasmSoni || tekshiruv?.rasmli || 0;

  return (
    <Modal open onClose={onClose} title="Katalogni fayldan yuklash">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          CSV yoki Excel (.xlsx) fayl. Sarlavhada kamida{" "}
          <code className="text-fg">Nomi</code> ustuni bo&apos;lishi shart; qolganlari ixtiyoriy:{" "}
          <code className="text-fg">SKU, Shtrix kod, Kategoriya, Birlik, Tannarx, Sotuv narxi,
          Qoldiq, Min qoldiq, Izoh, Rasm</code>. Excel ichidagi tovar rasmlari ham import
          qilinadi.
        </p>
        <button type="button" onClick={namunaYuklab} className="text-sm text-brand hover:underline">
          Namuna faylni yuklab olish
        </button>

        <input
          type="file"
          accept=".csv,.xlsx,text/csv"
          onChange={faylTanlandi}
          className="w-full text-sm text-fg file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-surface-2 file:text-fg"
        />
        {fayl && <p className="text-2xs text-faint">Fayl: {fayl.name}</p>}

        <div className="border-t border-line pt-3">
          <p className="text-sm font-medium text-fg mb-2">Bazada shu nom/kod bor bo&apos;lsa</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRejim("qoshish")}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm ${rejim === "qoshish" ? "border-brand bg-brand-wash text-brand font-medium" : "border-line text-muted"}`}
            >
              Tegilmasin
            </button>
            <button
              type="button"
              onClick={() => setRejim("yangilash")}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm ${rejim === "yangilash" ? "border-brand bg-brand-wash text-brand font-medium" : "border-line text-muted"}`}
            >
              Yangilansin
            </button>
          </div>
          <p className="text-2xs text-faint mt-2">
            Yangilashda faqat faylda BOR ustunlar o&apos;zgaradi — narx ustuni yo&apos;q fayl
            narxlarni nolga tushirmaydi.
          </p>
        </div>

        {tekshiruv && (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-sm text-fg">
              Topildi: <span className="font-semibold">{tekshiruv.jami}</span> ta tovar
              {rasmSoni > 0 && <span className="text-muted"> · rasm: {rasmSoni}</span>}
              {tekshiruv.xatolar.length > 0 && (
                <span className="text-expense"> · xato: {tekshiruv.xatolar.length}</span>
              )}
            </p>
            {oqim.rasmSoni > 0 && oqim.saqlagichBormi === false && (
              <p className="text-2xs text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2">
                Rasm saqlagich sozlanmagan — tovarlar rasmSIZ yuklanadi. Rasmlarni keyin
                tovar kartasidan havola sifatida qo&apos;shish mumkin.
              </p>
            )}
            {(tekshiruv.narxsiz > 0 || tekshiruv.qoldiqsiz > 0) && (
              <p className="text-2xs text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2">
                Kassada sotish uchun tovarning narxi ham, qoldig&apos;i ham bo&apos;lishi kerak.
                Bu faylda narxsiz — {tekshiruv.narxsiz} ta, qoldiqsiz — {tekshiruv.qoldiqsiz} ta.
                Ular baribir qo&apos;shiladi; narx va qoldiqni keyin kiritasiz (eksport qilib
                Excel&apos;da to&apos;ldirib qayta yuklash eng tez yo&apos;l).
              </p>
            )}
            {tekshiruv.namuna.length > 0 && (
              <div className="jadval-siljish max-h-48 overflow-y-auto">
                <table className="w-full text-2xs">
                  <thead className="text-faint uppercase text-left">
                    <tr>
                      <th className="pb-1">Nomi</th>
                      <th className="pb-1">Kategoriya</th>
                      <th className="pb-1 text-right">Narx</th>
                      <th className="pb-1 text-right">Qoldiq</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {tekshiruv.namuna.map((q) => (
                      <tr key={q.qator}>
                        <td className="py-1">{q.nomi}</td>
                        <td className="text-muted">{q.kategoriya ?? "—"}</td>
                        <td className="text-right tnum">
                          {q.sotuvNarx ? formatSom(q.sotuvNarx) : "—"}
                        </td>
                        <td className="text-right tnum">{q.miqdor ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tekshiruv.jami > tekshiruv.namuna.length && (
                  <p className="text-2xs text-faint mt-1">
                    …va yana {tekshiruv.jami - tekshiruv.namuna.length} ta
                  </p>
                )}
              </div>
            )}
            {tekshiruv.xatolar.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {tekshiruv.xatolar.slice(0, 20).map((x) => (
                  <p key={x.qator} className="text-2xs text-expense">
                    {x.qator}-qator: {x.xato}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {bosqich && <p className="text-sm text-muted">{bosqich}</p>}
        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => void oqim.tasdiqla()}
            loading={loading}
            disabled={!tekshiruv || tekshiruv.jami === 0}
          >
            {tekshiruv ? `${tekshiruv.jami} ta tovarni yuklash` : "Yuklash"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
