"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FAOLIYATLAR, faoliyatByCode } from "@/lib/biznesFaoliyati";
import type { YangiBiznes } from "./turlar";

/**
 * YANGI BIZNES — faoliyat savoli bilan.
 *
 * Ilgari bu yerda ikkita TEXNIK savol bor edi ("Rejim" va "Ombor yuritiladimi").
 * Do'kon ochayotgan odam ular nimani anglatishini bilishi shart emas; u
 * "biznesim qanday ishlaydi" degan savolga javob bera oladi. Shuning uchun
 * endi bitta tushunarli savol so'raladi va bayroqlar undan chiqariladi
 * (lib/biznesFaoliyati.ts).
 *
 * Tanlov hech narsani QULFLAMAYDI: keyin Bizneslar va Sozlamalar → Modullar
 * bo'limlaridan hammasini o'zgartirish mumkin.
 */
export function YangiBiznesModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (b: YangiBiznes) => void;
}) {
  const [nomi, setNomi] = useState("");
  const [faoliyat, setFaoliyat] = useState<string>("xizmat");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tanlangan = faoliyatByCode(faoliyat);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomi, faoliyat }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Xatolik yuz berdi");
      setLoading(false);
      return;
    }
    onCreated(data);
  }

  return (
    <Modal open onClose={onClose} title="Yangi biznes">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={nomi}
          onChange={(e) => setNomi(e.target.value)}
          placeholder="Biznes nomi (masalan: Salyut)"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          autoFocus
          required
        />

        <div>
          <label className="block text-sm font-medium text-fg mb-2">
            Biznesingiz qanday ishlaydi?
          </label>
          <div className="space-y-2">
            {FAOLIYATLAR.map((f) => (
              <label
                key={f.code}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  faoliyat === f.code ? "border-brand bg-brand-wash" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="faoliyat"
                  value={f.code}
                  checked={faoliyat === f.code}
                  onChange={() => setFaoliyat(f.code)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-fg">{f.nomi}</span>
                  <span className="block text-xs text-faint mt-0.5">{f.tavsif}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {tanlangan && (
          <p className="text-xs text-muted bg-surface-2 rounded-lg px-3 py-2">
            Yoqiladi:{" "}
            {[
              tanlangan.omborli ? "Ombor va sotuv" : null,
              tanlangan.magazin ? "Magazin (kassa, QR/shtrix-kod)" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "faqat Moliya (kirim-chiqim)"}
            . Keyin Sozlamalar → Modullar bo&apos;limidan o&apos;zgartirasiz.
          </p>
        )}

        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saqlanmoqda..." : "Qo'shish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
