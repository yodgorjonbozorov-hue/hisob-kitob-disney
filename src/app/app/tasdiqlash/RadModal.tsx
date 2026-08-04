"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/** Rad etish — sabab MAJBURIY, xodim nima uchun rad etilganini bilishi kerak. */
export function RadModal({
  requestId,
  onClose,
  onDone,
}: {
  requestId: string;
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
      const res = await fetch(`/api/tasdiqlash/sorovlar/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qaror: "rad", sabab }),
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

  return (
    <Modal open onClose={onClose} title="So'rovni rad etish">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="rad-sabab">
            Sabab
          </label>
          <input
            id="rad-sabab"
            value={sabab}
            onChange={(e) => setSabab(e.target.value)}
            required
            minLength={3}
            maxLength={300}
            placeholder="Masalan: bu xarid budjetdan tashqarida"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg"
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="danger" loading={loading}>
            Rad etish
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
