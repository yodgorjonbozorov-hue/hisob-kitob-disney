"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { formatSom, parseSomInput } from "@/lib/format";
import { BIRLIKLAR } from "@/lib/validation/inventory";
import { RasmTanlash } from "./RasmTanlash";
import type { OmborKategoriyaDTO } from "@/lib/queries/ombor";

export interface YangiMahsulotNatija {
  id: string;
  nomi: string;
  birlik: string;
  kelganNarx: number;
  sotuvNarx: number;
}

/**
 * YANGI MAHSULOT — minimal forma.
 *
 * Ko'rinadigan maydonlar: rasm, nom, kategoriya, o'lchov, xarid narxi, sotuv
 * narxi. SKU va minimal qoldiq "Qo'shimcha" ostida yashiringan — ular
 * foydalanuvchining birinchi 10 ta mahsulotida deyarli hech qachon kerak
 * bo'lmaydi, lekin formani ikki barobar uzaytiradi.
 *
 * Telefon uchun: `Modal` mobil'da pastdan chiqadigan varaq, submit tugmasi
 * esa formaning ICHIDA oxirgi element — klaviatura ochilganda u varaq bilan
 * birga suriladi va yo'qolib qolmaydi.
 */
export function YangiMahsulot({
  kategoriyalar,
  boshlangichNomi,
  onClose,
  onDone,
}: {
  kategoriyalar: OmborKategoriyaDTO[];
  boshlangichNomi?: string;
  onClose: () => void;
  onDone: (m: YangiMahsulotNatija) => void;
}) {
  const [nomi, setNomi] = useState(boshlangichNomi ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [birlik, setBirlik] = useState<string>("dona");
  const [xarid, setXarid] = useState("");
  const [sotuv, setSotuv] = useState("");
  const [sku, setSku] = useState("");
  const [minQoldiq, setMinQoldiq] = useState("");
  const [rasmUrl, setRasmUrl] = useState<string | null>(null);
  const [qoshimcha, setQoshimcha] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setXato(null);
    setSaqlanmoqda(true);
    try {
      const res = await fetch("/api/ombor/mahsulotlar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomi: nomi.trim(),
          categoryId: categoryId || null,
          birlik,
          kelganNarx: parseSomInput(xarid),
          sotuvNarx: parseSomInput(sotuv),
          sku: sku.trim() || null,
          minQoldiq: minQoldiq ? Number(minQoldiq) : 0,
          rasmUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setXato(data.error ?? "Mahsulotni saqlab bo'lmadi");
        return;
      }
      onDone({
        id: data.id,
        nomi: data.nomi,
        birlik: data.birlik,
        kelganNarx: data.kelganNarx,
        sotuvNarx: data.sotuvNarx,
      });
    } finally {
      setSaqlanmoqda(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Yangi mahsulot">
      <form onSubmit={submit} className="space-y-4">
        <RasmTanlash qiymat={rasmUrl} onChange={setRasmUrl} />

        <div>
          <label className={LABEL_CLASS} htmlFor="ym-nomi">
            Mahsulot nomi
          </label>
          <input
            id="ym-nomi"
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            placeholder="Masalan: Atirgul 50sm"
            className={INPUT_CLASS}
            maxLength={100}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="ym-kat">
              Kategoriya
            </label>
            <select
              id="ym-kat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Yo&apos;q</option>
              {kategoriyalar.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nomi}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="ym-birlik">
              O&apos;lchov
            </label>
            <select
              id="ym-birlik"
              value={birlik}
              onChange={(e) => setBirlik(e.target.value)}
              className={INPUT_CLASS}
            >
              {BIRLIKLAR.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="ym-xarid">
              Xarid narxi
            </label>
            <input
              id="ym-xarid"
              inputMode="numeric"
              value={xarid}
              onChange={(e) => setXarid(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
              placeholder="0"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="ym-sotuv">
              Sotuv narxi
            </label>
            <input
              id="ym-sotuv"
              inputMode="numeric"
              value={sotuv}
              onChange={(e) => setSotuv(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
              placeholder="0"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {!qoshimcha ? (
          <button
            type="button"
            onClick={() => setQoshimcha(true)}
            className="text-sm text-brand hover:underline"
          >
            Qo&apos;shimcha (SKU, minimal qoldiq)
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS} htmlFor="ym-sku">
                SKU / kod
              </label>
              <input
                id="ym-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                maxLength={40}
                placeholder="ixtiyoriy"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="ym-min">
                Minimal qoldiq
              </label>
              <input
                id="ym-min"
                inputMode="numeric"
                value={minQoldiq}
                onChange={(e) => setMinQoldiq(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                className={INPUT_CLASS}
              />
            </div>
          </div>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose} className="flex-1">
            Bekor
          </Button>
          <Button type="submit" size="lg" loading={saqlanmoqda} className="flex-[2]">
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
