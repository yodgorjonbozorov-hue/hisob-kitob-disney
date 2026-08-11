"use client";

import { useState, type FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  KUNLIK_TOLOV_BELGI,
  KUNLIK_TOLOV_NOMI,
  KUNLIK_TOLOV_TURLARI,
  type KunlikTolovTuri,
} from "@/lib/validation/kunlik";

/** Bugungi kunga tushum kiritish kartasi — xodimning asosiy amali. */
export function TushumForm({ onDone }: { onDone: () => void }) {
  const [summa, setSumma] = useState("");
  const [tolovTuri, setTolovTuri] = useState<KunlikTolovTuri>("CASH");
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const son = Number(summa.replace(/[\s,]/g, ""));
    if (!Number.isInteger(son) || son <= 0) {
      setXato("Summa 0 dan katta butun son bo'lishi kerak");
      return;
    }
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kunlik/tushum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summa: son, tolovTuri, izoh: izoh.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setSumma("");
      setIzoh("");
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold text-fg mb-3">Tushum kiritish</h2>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {KUNLIK_TOLOV_TURLARI.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTolovTuri(t)}
              className={`px-3 py-2 rounded-lg border text-sm transition ${
                tolovTuri === t
                  ? "border-brand bg-brand-wash text-brand font-medium"
                  : "border-line bg-surface-2 text-fg hover:border-brand"
              }`}
            >
              {KUNLIK_TOLOV_BELGI[t]} {KUNLIK_TOLOV_NOMI[t]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="kunlik-summa">
              Summa (so&apos;m)
            </label>
            <input
              id="kunlik-summa"
              value={summa}
              onChange={(e) => setSumma(e.target.value)}
              required
              inputMode="numeric"
              placeholder="150 000"
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg tnum"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="kunlik-izoh">
              Izoh (ixtiyoriy)
            </label>
            <input
              id="kunlik-izoh"
              value={izoh}
              onChange={(e) => setIzoh(e.target.value)}
              maxLength={300}
              placeholder="Masalan: guldasta buyurtmasi"
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg"
            />
          </div>
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <Button type="submit" loading={loading}>
          Qo&apos;shish
        </Button>
      </form>
    </Card>
  );
}
