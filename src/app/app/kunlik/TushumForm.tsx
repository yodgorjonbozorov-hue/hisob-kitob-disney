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
import { Select } from "@/components/ui/Select";
import { SummaInput, sonOqi } from "./SummaInput";

/**
 * TUSHUM KIRITISH — xodimning asosiy amali.
 *
 * ═══ BU ODDIY KIRIM (dublikat emas) ═══
 * Yuborilganda serverda HAQIQIY kirim yozuvi (`Transaction`) yaraladi va
 * unga bog'langan kunlik qatori quriladi. Ya'ni bu forma "ikkinchi kirim
 * daftari" emas — u Yozuvlar bo'limidagi kirim bilan AYNAN bir xil yozuvni
 * yaratadi, faqat kassir uchun qisqartirilgan ko'rinishda: kategoriya,
 * summa, to'lov turi.
 *
 * Shu sababli kategoriya tanlanadi — aks holda pul "Kunlik tushum" degan
 * yagona zaxira kategoriyaga to'planib, kategoriya kesimini ma'nosiz
 * qilib qo'yardi.
 */
export function TushumForm({
  kategoriyalar,
  onDone,
}: {
  kategoriyalar: { id: string; nomi: string }[];
  onDone: () => void;
}) {
  const [summa, setSumma] = useState("");
  const [tolovTuri, setTolovTuri] = useState<KunlikTolovTuri>("CASH");
  const [categoryId, setCategoryId] = useState(kategoriyalar[0]?.id ?? "");
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const son = sonOqi(summa);
    if (son === null || son <= 0) {
      setXato("Summa 0 dan katta butun son bo'lishi kerak");
      return;
    }
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kunlik/tushum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summa: son,
          tolovTuri,
          categoryId: categoryId || undefined,
          izoh: izoh.trim() || undefined,
        }),
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
      <h2 className="font-semibold text-fg">Tushum kiritish</h2>
      <p className="text-2xs text-faint mb-3">
        Bu oddiy KIRIM yozuvi — Jami Kirim va kassa qoldig&apos;iga darhol tushadi.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <p className="text-sm text-muted mb-1.5">To&apos;lov turi</p>
          <div className="grid grid-cols-3 gap-2">
            {KUNLIK_TOLOV_TURLARI.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTolovTuri(t)}
                aria-pressed={tolovTuri === t}
                className={`min-h-[48px] px-2 rounded-xl border text-sm transition ${
                  tolovTuri === t
                    ? "border-brand bg-brand-wash text-brand font-medium"
                    : "border-line bg-surface-2 text-fg hover:border-brand"
                }`}
              >
                {KUNLIK_TOLOV_BELGI[t]} {KUNLIK_TOLOV_NOMI[t]}
              </button>
            ))}
          </div>
          {tolovTuri === "DEBT" && (
            <p className="text-2xs text-faint mt-1">
              📋 Qarz — pul kassaga tushmaydi, kassa qoldig&apos;i o&apos;zgarmaydi.
            </p>
          )}
        </div>

        {kategoriyalar.length > 0 && (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="kunlik-kategoriya">
              Kategoriya
            </label>
            <Select
              id="kunlik-kategoriya"
              value={categoryId}
              onChange={setCategoryId}
              searchable={kategoriyalar.length > 7}
              options={kategoriyalar.map((k) => ({ value: k.id, label: k.nomi }))}
            />
          </div>
        )}

        <SummaInput id="kunlik-summa" label="Summa (so'm)" value={summa} onChange={setSumma} />

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
            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-surface-2 border border-line text-fg focus:border-brand focus:outline-none"
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <Button type="submit" loading={loading} size="lg" className="w-full sm:w-auto">
          Qo&apos;shish
        </Button>
      </form>
    </Card>
  );
}
