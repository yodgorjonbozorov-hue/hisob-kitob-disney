"use client";

import { useState, type ChangeEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSom } from "@/lib/format";
import { ImportNatija } from "./ImportNatija";

interface XatoQator {
  qator: number;
  xato: string;
  matn: string;
}
interface NamunaQator {
  qator: number;
  nomi: string;
  sku: string | null;
  barcode: string | null;
  kategoriya: string | null;
  sotuvNarx?: number | null;
  miqdor?: number | null;
}
interface Tekshiruv {
  jami: number;
  ustunlar: string[];
  xatolar: XatoQator[];
  namuna: NamunaQator[];
  maxQator: number;
  narxsiz: number;
  qoldiqsiz: number;
}
export interface Natija {
  qoshildi: number;
  yangilandi: number;
  otkazildi: number;
  qoldiqTogrilandi: number;
  xatolar: XatoQator[];
}

const NAMUNA_CSV = `Nomi,SKU,Shtrix kod,Kategoriya,Birlik,Tannarx,Sotuv narxi,Qoldiq,Min qoldiq,Izoh
Coca-Cola 1L,,4601234567890,Ichimlik,dona,9000,12000,48,10,
Shar 12 dyuym,SH-012,,Sharlar,dona,1500,4000,200,20,`;

/**
 * KATALOG IMPORTI — ikki bosqichli.
 *
 * Avval fayl tekshiriladi va natija ko'rsatiladi (nechta tovar, qaysi
 * ustunlar tanildi, nechta xato, narxsiz/qoldiqsiz nechta). Foydalanuvchi
 * ko'rgandan keyingina yozadi: yuzlab tovarni ko'r-ko'rona qo'shib yuborish
 * xavfi yo'q.
 */
export function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [fayl, setFayl] = useState<File | null>(null);
  const [rejim, setRejim] = useState<"qoshish" | "yangilash">("qoshish");
  const [tekshiruv, setTekshiruv] = useState<Tekshiruv | null>(null);
  const [natija, setNatija] = useState<Natija | null>(null);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function yubor(f: File, tekshirish: boolean) {
    const form = new FormData();
    form.append("fayl", f);
    form.append("rejim", rejim);
    if (tekshirish) form.append("tekshirish", "true");
    const res = await fetch("/api/products/import", { method: "POST", body: form });
    return { res, data: await res.json() };
  }

  async function faylTanlandi(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFayl(f);
    setNatija(null);
    setXato(null);
    setLoading(true);
    try {
      const { res, data } = await yubor(f, true);
      if (!res.ok) setXato(data.error ?? "Faylni o'qib bo'lmadi");
      else setTekshiruv(data);
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  async function tasdiqla() {
    if (!fayl) return;
    setLoading(true);
    setXato(null);
    try {
      const { res, data } = await yubor(fayl, false);
      if (!res.ok) setXato(data.error ?? "Import qilib bo'lmadi");
      else {
        setNatija(data);
        onDone();
      }
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
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
    return <ImportNatija natija={natija} onClose={onClose} />;
  }

  return (
    <Modal open onClose={onClose} title="Katalogni fayldan yuklash">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          CSV yoki Excel (.xlsx) fayl. Sarlavhada kamida{" "}
          <code className="text-fg">Nomi</code> ustuni bo&apos;lishi shart; qolganlari ixtiyoriy:{" "}
          <code className="text-fg">SKU, Shtrix kod, Kategoriya, Birlik, Tannarx, Sotuv narxi,
          Qoldiq, Min qoldiq, Izoh</code>. Boshqa dasturdan olingan fayl ustunlari ham tanilishi
          mumkin.
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
              {tekshiruv.xatolar.length > 0 && (
                <span className="text-expense"> · xato: {tekshiruv.xatolar.length}</span>
              )}
            </p>
            {(tekshiruv.narxsiz > 0 || tekshiruv.qoldiqsiz > 0) && (
              <p className="text-2xs text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2">
                Kassada sotish uchun tovarning narxi ham, qoldig&apos;i ham bo&apos;lishi kerak.
                Bu faylda narxsiz — {tekshiruv.narxsiz} ta, qoldiqsiz — {tekshiruv.qoldiqsiz} ta.
                Ular baribir qo&apos;shiladi; narx va qoldiqni keyin kiritasiz (eksport qilib
                Excel&apos;da to&apos;ldirib qayta yuklash eng tez yo&apos;l).
              </p>
            )}
            {tekshiruv.namuna.length > 0 && (
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
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

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button onClick={tasdiqla} loading={loading} disabled={!tekshiruv || tekshiruv.jami === 0}>
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
