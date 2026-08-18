"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSomLabel } from "@/lib/format";
import type { TransactionDTO } from "@/lib/queries/transactions";
import {
  KategoriyaSanaFiltr,
  presetOraliq,
  type SanaOraliq,
  type SanaPreset,
} from "./KategoriyaSanaFiltr";
import { KategoriyaYozuvlar, KategoriyaSkelet, type KunlikJami } from "./KategoriyaYozuvlar";

const SAHIFA = 20;

export interface KategoriyaTanlov {
  categoryId: string;
  nomi: string;
  /** "kirim" | "chiqim" — kirim va chiqim ATAYLAB aralashmaydi. */
  turi: "kirim" | "chiqim";
}

/**
 * KATEGORIYA TAFSILOTI — bosh sahifadagi taqsimot qatoridan ochiladi.
 *
 * FILTR SERVERDA: `categoryId`, `turi`, sana oralig'i va qidiruv so'rovga
 * qo'yiladi (`/api/transactions`), brauzerda qayta filtrlash YO'Q. Aks holda
 * sahifalash bilan birga ishlaganda ro'yxat to'liqsiz chiqardi.
 *
 * `realPul=1` — eng muhim parametr: bosh sahifadagi kategoriya summasi
 * qarzga yozilgan yozuvlarni hisobga olmaydi, shuning uchun tafsilot ham
 * olmasligi kerak. Busiz ikki ekranda ikki xil raqam chiqardi.
 */
export function KategoriyaTafsilot({
  tanlov,
  oy,
  oyNomi,
  onClose,
}: {
  tanlov: KategoriyaTanlov;
  /** Bosh sahifada tanlangan oy oralig'i — boshlang'ich (va asosiy) davr. */
  oy: SanaOraliq;
  oyNomi: string;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState<SanaPreset>("oy");
  const [oraliq, setOraliq] = useState<SanaOraliq>(oy);
  const [q, setQ] = useState("");
  const [qidiruv, setQidiruv] = useState("");

  const [items, setItems] = useState<TransactionDTO[]>([]);
  const [kunlik, setKunlik] = useState<KunlikJami[] | null>(null);
  const [jami, setJami] = useState(0);
  const [soni, setSoni] = useState(0);
  const [sahifa, setSahifa] = useState(1);
  const [yuklanmoqda, setYuklanmoqda] = useState(true);
  const [xato, setXato] = useState<string | null>(null);

  const kirim = tanlov.turi === "kirim";

  // Qidiruv "debounce" bilan — har harfda so'rov ketmasin.
  useEffect(() => {
    const t = setTimeout(() => setQidiruv(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const yukla = useCallback(
    async (sahifaN: number) => {
      setYuklanmoqda(true);
      setXato(null);
      try {
        const p = new URLSearchParams({
          turi: tanlov.turi,
          categoryId: tanlov.categoryId,
          realPul: "1",
          kunlik: "1",
          page: String(sahifaN),
          pageSize: String(SAHIFA),
        });
        if (oraliq.from) p.set("from", oraliq.from);
        if (oraliq.to) p.set("to", oraliq.to);
        if (qidiruv) p.set("q", qidiruv);

        const res = await fetch(`/api/transactions?${p.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setXato(data.error ?? "Yozuvlarni yuklab bo'lmadi");
          return;
        }
        // Keyingi sahifa QO'SHILADI, birinchisi esa ro'yxatni almashtiradi.
        setItems((oldingi) => (sahifaN === 1 ? data.items : [...oldingi, ...data.items]));
        setKunlik(data.kunlik ?? null);
        setJami(kirim ? data.totals.jamiKirim : data.totals.jamiChiqim);
        setSoni(data.total);
        setSahifa(sahifaN);
      } catch {
        setXato("Serverga ulanib bo'lmadi");
      } finally {
        setYuklanmoqda(false);
      }
    },
    [tanlov.turi, tanlov.categoryId, oraliq.from, oraliq.to, qidiruv, kirim]
  );

  // Filtr o'zgarganda ro'yxat boshidan o'qiladi.
  useEffect(() => {
    void yukla(1);
  }, [yukla]);

  const yanaBor = items.length < soni;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${tanlov.nomi} — ${kirim ? "Kirimlar" : "Chiqimlar"}`}
    >
      <div className="space-y-3">
        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <p className="text-xs text-muted">{kirim ? "Jami kirim" : "Jami chiqim"}</p>
          <p className={`text-2xl font-bold tnum ${kirim ? "text-income" : "text-expense"}`}>
            {formatSomLabel(jami)}
          </p>
          <p className="text-2xs text-faint mt-0.5 tnum">{soni} ta yozuv</p>
        </div>

        <KategoriyaSanaFiltr
          preset={preset}
          oraliq={oraliq}
          oyNomi={oyNomi}
          onChange={(p, o) => {
            setPreset(p);
            setOraliq(p === "oy" ? oy : o);
          }}
        />

        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Izoh bo'yicha qidirish..."
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          aria-label="Yozuvlar orasidan qidirish"
        />

        {xato && (
          <div className="rounded-lg border border-expense/40 bg-expense-soft/30 px-3 py-3 text-center">
            <p className="text-sm text-expense">Yozuvlarni yuklashda xatolik yuz berdi.</p>
            <p className="text-2xs text-muted mt-0.5">{xato}</p>
            <Button variant="secondary" className="mt-2" onClick={() => void yukla(1)}>
              Qayta urinish
            </Button>
          </div>
        )}

        {!xato && yuklanmoqda && items.length === 0 && <KategoriyaSkelet />}

        {!xato && !yuklanmoqda && items.length === 0 && (
          <div className="text-center py-8">
            <p className="font-medium text-fg">Yozuv topilmadi</p>
            <p className="text-sm text-muted mt-1">
              Bu kategoriya bo&apos;yicha tanlangan davrda hech qanday yozuv mavjud emas.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <KategoriyaYozuvlar items={items} kunlik={kunlik} kirim={kirim} />
        )}

        {yanaBor && (
          <Button
            variant="secondary"
            className="w-full"
            disabled={yuklanmoqda}
            onClick={() => void yukla(sahifa + 1)}
          >
            {yuklanmoqda ? "Yuklanmoqda..." : `Ko'proq (${soni - items.length} ta qoldi)`}
          </Button>
        )}
      </div>
    </Modal>
  );
}
