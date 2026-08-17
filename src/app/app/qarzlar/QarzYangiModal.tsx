"use client";

import { useState, FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSom, parseSomInput } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import { QARZ_MATN, type QarzTuri } from "@/lib/biznesTuri";
import { MijozTanlash, type MijozTanlov } from "@/components/qarz/MijozTanlash";

export interface QarzProductOption {
  id: string;
  nomi: string;
}

const BOSH_MIJOZ: MijozTanlov = { contactId: null, ism: "", tel: "" };

/**
 * Qo'lda qarzdorlik qo'shish — ikki yo'nalishda ham (sotuvsiz).
 *
 * Pul harakati YOZILMAYDI. "Shundan to'langan" maydoni ham kirim yaratmaydi:
 * u TIZIMGA KIRITILISHIDAN OLDIN to'langan qismni bildiradi (tarixiy qarzni
 * ko'chirish uchun). Tizim ichidagi to'lovlar faqat "To'lov qilish" orqali —
 * aks holda bitta pul ikki marta hisoblanardi.
 */
export function QarzYangiModal({
  turi: boshlangichTuri,
  products,
  avto,
  mijoz: boshlangichMijoz,
  onClose,
  onDone,
}: {
  turi: QarzTuri;
  products: QarzProductOption[];
  avto: boolean;
  /** Qarzdor kartochkasidan ochilganda — mijoz oldindan to'ldiriladi. */
  mijoz?: MijozTanlov | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [turi, setTuri] = useState<QarzTuri>(boshlangichTuri);
  const [mijoz, setMijoz] = useState<MijozTanlov>(boshlangichMijoz ?? BOSH_MIJOZ);
  const [summa, setSumma] = useState("");
  const [tolangan, setTolangan] = useState("");
  const [productId, setProductId] = useState("");
  const [sana, setSana] = useState(todayDateOnlyString());
  const [muddat, setMuddat] = useState("");
  const [izoh, setIzoh] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const jamiSumma = parseSomInput(summa);
    if (!mijoz.ism.trim()) {
      setError("Mijozni tanlang yoki ismini kiriting");
      return;
    }
    if (jamiSumma <= 0) {
      setError("Summani kiriting");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turi,
          contactId: mijoz.contactId,
          mijozNomi: mijoz.contactId ? undefined : mijoz.ism.trim(),
          mijozTel: mijoz.tel.trim() || undefined,
          jamiSumma,
          tolangan: tolangan ? parseSomInput(tolangan) : 0,
          productId: productId || undefined,
          sana,
          muddat: muddat || undefined,
          izoh: izoh.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Xatolik");
        return;
      }
      onDone();
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Yangi qarzdorlik">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["olinadigan", "beriladigan"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTuri(t)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                turi === t ? "border-brand text-brand bg-brand/5" : "border-line text-muted"
              }`}
            >
              {QARZ_MATN[t].nomi}
            </button>
          ))}
        </div>
        <p className="text-xs text-faint">{QARZ_MATN[turi].tavsif}</p>

        <MijozTanlash qiymat={mijoz} onChange={setMijoz} disabled={loading} />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="yq-summa">
              Qarz summasi
            </label>
            <input
              id="yq-summa"
              type="text"
              inputMode="numeric"
              value={summa}
              onChange={(e) => setSumma(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
              placeholder="0"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="yq-tolangan">
              Ilgari to&apos;langan (ixtiyoriy)
            </label>
            <input
              id="yq-tolangan"
              type="text"
              inputMode="numeric"
              value={tolangan}
              onChange={(e) => setTolangan(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
              placeholder="0"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-faint">
          Qarz pul harakatini yozmaydi. &quot;Ilgari to&apos;langan&quot; — tizimdan tashqarida
          olingan qism; u ham kirim yaratmaydi.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="yq-sana">
              Berilgan sana
            </label>
            <input
              id="yq-sana"
              type="date"
              value={sana}
              onChange={(e) => setSana(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="yq-muddat">
              To&apos;lov muddati (ixtiyoriy)
            </label>
            <input
              id="yq-muddat"
              type="date"
              value={muddat}
              onChange={(e) => setMuddat(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
        </div>

        {products.length > 0 && (
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="yq-product">
              {avto ? "Mashina" : "Mahsulot"} (ixtiyoriy)
            </label>
            <select
              id="yq-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
            >
              <option value="">Bog&apos;lanmagan</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nomi}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="yq-izoh">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="yq-izoh"
            type="text"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Qo'shish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
