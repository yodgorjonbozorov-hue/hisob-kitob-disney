"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * CSV EKSPORT TUGMASI.
 *
 * POST bilan yuboriladi (oddiy havola emas) — eksport SABAB talab qiladi va
 * auditga tushadi. Fayl javobdan blob sifatida olinadi va brauzerda saqlanadi.
 */
export function Eksport({
  turi,
  label = "Eksport (CSV)",
}: {
  turi: "bizneslar" | "foydalanuvchilar" | "obunalar" | "billing" | "audit";
  label?: string;
}) {
  const [ochiq, setOchiq] = useState(false);
  const [sabab, setSabab] = useState("");
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function yubor(e: FormEvent) {
    e.preventDefault();
    setBand(true);
    setXato(null);
    try {
      const res = await fetch("/api/superadmin/eksport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turi, sabab: sabab.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setXato(data.error ?? `Server xatosi (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `balansa-${turi}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setOchiq(false);
      setSabab("");
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBand(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOchiq(true)}>
        {label}
      </Button>
      <Modal open={ochiq} onClose={() => !band && setOchiq(false)} title="Ma'lumotni eksport qilish">
        <form onSubmit={yubor} className="space-y-4">
          <div className="rounded-lg bg-surface-2 border border-line p-3 text-sm text-fg">
            <p className="text-2xs uppercase tracking-wide text-faint font-medium mb-1.5">
              Nima bo&apos;ladi
            </p>
            <ul className="space-y-1">
              <li>· CSV fayl yuklab olinadi (maksimal 10 000 qator).</li>
              <li>· Parol, token va Telegram identifikatorlari faylga CHIQMAYDI.</li>
              <li>· Eksport hodisasi audit jurnaliga sabab bilan yoziladi.</li>
            </ul>
          </div>
          <div>
            <label htmlFor="eksport-sabab" className="block text-sm font-medium text-fg mb-1">
              Sabab <span className="text-expense">*</span>
            </label>
            <textarea
              id="eksport-sabab"
              rows={2}
              required
              minLength={10}
              value={sabab}
              onChange={(e) => setSabab(e.target.value)}
              placeholder="Ma'lumot nima uchun chiqarilmoqda?"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            />
          </div>
          {xato && (
            <p className="text-sm text-expense-fg bg-expense-soft rounded-lg px-3 py-2" role="alert">
              {xato}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOchiq(false)} disabled={band}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={band} disabled={sabab.trim().length < 10}>
              Yuklab olish
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
