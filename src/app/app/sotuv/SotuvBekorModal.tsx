"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * Sotuvni bekor qilish. Sabab MAJBURIY — bu shunchaki formallik emas:
 * audit jurnalida "nega bekor qilindi" savoliga javob qolishi kerak.
 */
export function SotuvBekorModal({
  saleId,
  onClose,
  onDone,
}: {
  saleId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [sabab, setSabab] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/sales/${saleId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sabab }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Bekor qilib bo'lmadi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Sotuvni bekor qilish">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">
          Tovar omborga qaytadi, kirim yozuvi bekor qilinadi. Sotuv tarixda
          &laquo;bekor qilingan&raquo; deb qoladi.
        </p>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="bekor-sabab">
            Sabab
          </label>
          <input
            id="bekor-sabab"
            value={sabab}
            onChange={(e) => setSabab(e.target.value)}
            required
            minLength={3}
            maxLength={300}
            placeholder="Masalan: xato mahsulot tanlandi"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg"
          />
        </div>
        {xato && <p className="text-sm text-expense">{xato}</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="danger" loading={loading}>
            Bekor qilish
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Yopish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
