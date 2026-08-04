"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { ProductAdminDTO } from "@/lib/queries/inventory";

type Turi = "inventarizatsiya" | "chiqarish";

const SARLAVHA: Record<Turi, string> = {
  inventarizatsiya: "Inventarizatsiya",
  chiqarish: "Hisobdan chiqarish",
};

/**
 * OMBOR QOLDIG'INI TO'G'RILASH.
 *
 * "Inventarizatsiya" — sanalgan qoldiq kiritiladi, farq avtomatik hisoblanadi.
 * "Hisobdan chiqarish" — buzilgan/yo'qolgan miqdor kiritiladi (faqat kamaytiradi).
 *
 * Sabab ikkalasida ham majburiy: bu yozuv keyin "kamomad qayerdan chiqdi?"
 * degan savolga javob bo'ladi.
 */
export function TogrilashModal({
  turi,
  products,
  onClose,
  onDone,
}: {
  turi: Turi;
  products: ProductAdminDTO[];
  onClose: () => void;
  onDone: () => void;
}) {
  const faollar = products.filter((p) => p.isActive);
  const [productId, setProductId] = useState(faollar[0]?.id ?? "");
  const [miqdor, setMiqdor] = useState("");
  const [sabab, setSabab] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const tanlangan = faollar.find((p) => p.id === productId);
  const son = Number(miqdor);
  const togri = Number.isInteger(son) && son >= 0 && miqdor !== "";
  const farq = tanlangan && togri
    ? turi === "inventarizatsiya"
      ? son - tanlangan.miqdor
      : -son
    : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, turi, miqdor: son, sabab }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

  return (
    <Modal open onClose={onClose} title={SARLAVHA[turi]}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tg-mahsulot">
            Mahsulot
          </label>
          <select
            id="tg-mahsulot"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={input}
          >
            {faollar.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nomi} — hisobda {p.miqdor} {p.birlik}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tg-miqdor">
            {turi === "inventarizatsiya" ? "Sanalgan qoldiq" : "Chiqariladigan miqdor"}
          </label>
          <input
            id="tg-miqdor"
            inputMode="numeric"
            value={miqdor}
            onChange={(e) => setMiqdor(e.target.value.replace(/[^0-9]/g, ""))}
            required
            placeholder="0"
            className={input}
          />
          {tanlangan && togri && farq !== 0 && (
            <p className={`text-2xs mt-1 ${farq < 0 ? "text-expense" : "text-income"}`}>
              Farq: {farq > 0 ? "+" : ""}
              {farq} {tanlangan.birlik}
              {turi === "inventarizatsiya" &&
                ` (hisobda ${tanlangan.miqdor} → ${son})`}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="tg-sabab">
            Sabab
          </label>
          <input
            id="tg-sabab"
            value={sabab}
            onChange={(e) => setSabab(e.target.value)}
            required
            minLength={3}
            maxLength={300}
            placeholder={
              turi === "inventarizatsiya" ? "Masalan: oylik sanash" : "Masalan: buzilgan tovar"
            }
            className={input}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading} disabled={!productId || !togri}>
            Saqlash
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
