"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSom, formatSomLabel } from "@/lib/format";
import type { TolovBolimi } from "@/lib/tolovBolimi";
import type { TolovTaqsimotiDTO, TolovBolimiDTO } from "@/lib/queries/tolovTaqsimoti";
import type { TransactionDTO } from "@/lib/queries/transactions";
import { KategoriyaYozuvlar, KategoriyaSkelet, type KunlikJami } from "@/components/kategoriya/KategoriyaYozuvlar";

const SAHIFA = 20;

/**
 * "JAMI KIRIM" / "JAMI CHIQIM" TAFSILOTI — ikki qavatli varaq.
 *
 *   1-qavat: jami summa va to'lov bo'limlari (foizi bilan);
 *   2-qavat: tanlangan bo'lim yozuvlari (orqaga qaytish tugmasi bilan).
 *
 * Taqsimot SERVERDAN prop sifatida keladi — qayta so'rov yo'q. Shu sababli
 * oyna darhol ochiladi va undagi jami kartadagi raqam bilan AYNAN bir xil
 * bo'ladi: ikkalasi ham bitta so'rovdan, bitta oy oralig'idan.
 *
 * Yozuvlar esa bo'lim tanlanganda `/api/transactions` dan olinadi —
 * filtrlash serverda (`tolovBolimi` parametri), brauzerda emas.
 */
export function PulOqimiTafsilot({
  taqsimot,
  oyFrom,
  oyTo,
  oyNomi,
  onClose,
}: {
  taqsimot: TolovTaqsimotiDTO;
  oyFrom: string;
  oyTo: string;
  oyNomi: string;
  onClose: () => void;
}) {
  const kirim = taqsimot.turi === "kirim";
  const [bolim, setBolim] = useState<TolovBolimiDTO | null>(null);

  const [items, setItems] = useState<TransactionDTO[]>([]);
  const [kunlik, setKunlik] = useState<KunlikJami[] | null>(null);
  const [soni, setSoni] = useState(0);
  const [sahifa, setSahifa] = useState(1);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const kod = bolim?.kod ?? null;

  const yukla = useCallback(
    async (sahifaN: number, tanlangan: TolovBolimi) => {
      setYuklanmoqda(true);
      setXato(null);
      try {
        const p = new URLSearchParams({
          turi: taqsimot.turi,
          tolovBolimi: tanlangan,
          from: oyFrom,
          to: oyTo,
          realPul: "1",
          kunlik: "1",
          page: String(sahifaN),
          pageSize: String(SAHIFA),
        });
        const res = await fetch(`/api/transactions?${p.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setXato(data.error ?? "Yozuvlarni yuklab bo'lmadi");
          return;
        }
        setItems((oldingi) => (sahifaN === 1 ? data.items : [...oldingi, ...data.items]));
        setKunlik(data.kunlik ?? null);
        setSoni(data.total);
        setSahifa(sahifaN);
      } catch {
        setXato("Serverga ulanib bo'lmadi");
      } finally {
        setYuklanmoqda(false);
      }
    },
    [taqsimot.turi, oyFrom, oyTo]
  );

  // Bo'lim tanlanganda ro'yxat boshidan o'qiladi.
  useEffect(() => {
    if (!kod) return;
    setItems([]);
    setKunlik(null);
    void yukla(1, kod);
  }, [kod, yukla]);

  const sarlavha = kirim ? "Kirimlar" : "Chiqimlar";
  const rang = kirim ? "text-income" : "text-expense";

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={bolim ? `${sarlavha} — ${bolim.nomi}` : `${sarlavha} · ${oyNomi}`}
    >
      <div className="space-y-3">
        {bolim && (
          <button
            type="button"
            onClick={() => setBolim(null)}
            className="text-sm text-brand hover:underline"
          >
            ‹ Barcha to&apos;lov turlari
          </button>
        )}

        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <p className="text-xs text-muted">{bolim ? bolim.nomi : `Jami ${kirim ? "kirim" : "chiqim"}`}</p>
          <p className={`text-2xl font-bold tnum ${rang}`}>
            {formatSomLabel(bolim ? bolim.summa : taqsimot.jami)}
          </p>
          <p className="text-2xs text-faint mt-0.5 tnum">
            {bolim
              ? `${bolim.foiz.toFixed(1)}% · ${bolim.soni} ta yozuv`
              : `${taqsimot.bolimlar.length} ta to'lov turi`}
          </p>
        </div>

        {!bolim && (
          <TolovBolimlari
            taqsimot={taqsimot}
            kirim={kirim}
            onSelect={setBolim}
          />
        )}

        {bolim && (
          <>
            {xato && (
              <div className="rounded-lg border border-expense/40 bg-expense-soft/30 px-3 py-3 text-center">
                <p className="text-sm text-expense">Yozuvlarni yuklashda xatolik yuz berdi.</p>
                <p className="text-2xs text-muted mt-0.5">{xato}</p>
                <Button variant="secondary" className="mt-2" onClick={() => void yukla(1, bolim.kod)}>
                  Qayta urinish
                </Button>
              </div>
            )}

            {!xato && yuklanmoqda && items.length === 0 && <KategoriyaSkelet />}

            {!xato && !yuklanmoqda && items.length === 0 && (
              <div className="text-center py-8">
                <p className="font-medium text-fg">Yozuv topilmadi</p>
                <p className="text-sm text-muted mt-1">
                  Bu to&apos;lov turi bo&apos;yicha tanlangan davrda yozuv mavjud emas.
                </p>
              </div>
            )}

            {items.length > 0 && (
              <KategoriyaYozuvlar items={items} kunlik={kunlik} kirim={kirim} />
            )}

            {items.length < soni && (
              <Button
                variant="secondary"
                className="w-full"
                disabled={yuklanmoqda}
                onClick={() => void yukla(sahifa + 1, bolim.kod)}
              >
                {yuklanmoqda ? "Yuklanmoqda..." : `Ko'proq (${soni - items.length} ta qoldi)`}
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/** 1-qavat: bo'limlar ro'yxati, foizli bar bilan. */
function TolovBolimlari({
  taqsimot,
  kirim,
  onSelect,
}: {
  taqsimot: TolovTaqsimotiDTO;
  kirim: boolean;
  onSelect: (b: TolovBolimiDTO) => void;
}) {
  if (taqsimot.bolimlar.length === 0) {
    return (
      <p className="text-faint text-sm text-center py-8">
        Bu oyda {kirim ? "kirim" : "chiqim"} yozuvi yo&apos;q.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-1">
        {taqsimot.bolimlar.map((b) => (
          <li key={b.kod}>
            <button
              type="button"
              onClick={() => onSelect(b)}
              className="w-full text-left rounded-lg px-2 py-2 transition hover:bg-surface-2 active:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-fg text-sm truncate">
                  <span aria-hidden className="mr-1.5">
                    {b.belgi}
                  </span>
                  {b.nomi}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium tnum text-fg">{formatSom(b.summa)}</span>
                  <span className="text-faint text-2xs tnum w-11 text-right">
                    {b.foiz.toFixed(1)}%
                  </span>
                  <span aria-hidden className="text-faint text-sm leading-none">
                    ›
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${kirim ? "bg-income" : "bg-expense"}`}
                  style={{ width: `${b.foiz}%` }}
                />
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Qarz jamiga KIRMAYDI — kartadagi raqam ham uni hisobga olmaydi.
          Lekin "pul qayerda?" degan savol javobsiz qolmasin. */}
      {taqsimot.qarz > 0 && (
        <p className="text-2xs text-faint border-t border-line pt-2">
          Bundan tashqari {formatSom(taqsimot.qarz)} so&apos;m qarzga yozilgan — pul hali
          kelmagani uchun jamiga kirmaydi.
        </p>
      )}
    </>
  );
}
