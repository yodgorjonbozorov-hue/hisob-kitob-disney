"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { formatSom, parseSomInput } from "@/lib/format";
import { RasmTanlash } from "./RasmTanlash";
import type { OmborKategoriyaDTO, OmborMahsulotDTO } from "@/lib/queries/ombor";

/**
 * MAHSULOTNI TAHRIRLASH.
 *
 * QOLDIQ BU YERDA YO'Q — u faqat ta'minot, sotuv yoki inventarizatsiya
 * orqali o'zgaradi. Qo'lda tahrirlash imkoni bo'lsa kamomad shunchaki
 * "tuzatib" qo'yilardi va kim/qachon/nega o'zgartirgani hech qayerda
 * qolmasdi. Qoldiqni to'g'rilash uchun "Inventarizatsiya" tabi bor.
 */
export function MahsulotTahrir({
  mahsulot,
  kategoriyalar,
  onClose,
  onDone,
}: {
  mahsulot: OmborMahsulotDTO;
  kategoriyalar: OmborKategoriyaDTO[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [nomi, setNomi] = useState(mahsulot.nomi);
  const [categoryId, setCategoryId] = useState(mahsulot.categoryId ?? "");
  const [xarid, setXarid] = useState(mahsulot.kelganNarx ? formatSom(mahsulot.kelganNarx) : "");
  const [sotuv, setSotuv] = useState(mahsulot.sotuvNarx ? formatSom(mahsulot.sotuvNarx) : "");
  const [minQoldiq, setMinQoldiq] = useState(mahsulot.minQoldiq ? String(mahsulot.minQoldiq) : "");
  const [rasmUrl, setRasmUrl] = useState<string | null>(mahsulot.rasmUrl);
  const [xato, setXato] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setXato(null);
    setSaqlanmoqda(true);
    try {
      const res = await fetch(`/api/ombor/mahsulotlar/${mahsulot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomi: nomi.trim(),
          categoryId: categoryId || null,
          kelganNarx: parseSomInput(xarid),
          sotuvNarx: parseSomInput(sotuv),
          minQoldiq: minQoldiq ? Number(minQoldiq) : 0,
          rasmUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setXato(data.error ?? "Saqlab bo'lmadi");
        return;
      }
      onDone();
      onClose();
    } finally {
      setSaqlanmoqda(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Mahsulotni tahrirlash">
      <form onSubmit={submit} className="space-y-4">
        <RasmTanlash qiymat={rasmUrl} onChange={setRasmUrl} />

        <div>
          <label className={LABEL_CLASS} htmlFor="mt-nomi">
            Nomi
          </label>
          <input
            id="mt-nomi"
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            className={INPUT_CLASS}
            maxLength={100}
            required
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="mt-kat">
            Kategoriya
          </label>
          <select
            id="mt-kat"
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="mt-xarid">
              Tannarx
            </label>
            <input
              id="mt-xarid"
              inputMode="numeric"
              value={xarid}
              onChange={(e) => setXarid(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="mt-sotuv">
              Sotuv narxi
            </label>
            <input
              id="mt-sotuv"
              inputMode="numeric"
              value={sotuv}
              onChange={(e) => setSotuv(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="mt-min">
            Minimal qoldiq{" "}
            <span className="text-muted font-normal">(0 = ogohlantirish yo&apos;q)</span>
          </label>
          <input
            id="mt-min"
            inputMode="numeric"
            value={minQoldiq}
            onChange={(e) => setMinQoldiq(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
            className={INPUT_CLASS}
          />
        </div>

        <p className="text-xs text-muted bg-surface-2 rounded-lg px-3 py-2">
          Qoldiq bu yerda o&apos;zgarmaydi — u ta&apos;minot, sotuv yoki
          inventarizatsiya orqali o&apos;zgaradi.
        </p>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2">
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
