"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatSom, formatMoney, parseSomInput } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import { Button } from "@/components/ui/Button";
import type { Rol } from "@/lib/auth/session";

interface CategoryOption {
  id: string;
  nomi: string;
  turi: string;
}

/**
 * Tez qo'shish (quick-add) — mobil FAB dan ochiladigan bottom sheet.
 * Segment (Kirim|Chiqim) → summa → kategoriya chiplari → izoh → Saqlash.
 * Sotuvchi uchun faqat kirim. Kategoriyalar lazy yuklanadi (/api/categories).
 */
export function QuickAddSheet({
  open,
  onClose,
  rol,
}: {
  open: boolean;
  onClose: () => void;
  rol: Rol;
}) {
  const router = useRouter();
  const kirimOnly = rol === "sotuvchi";
  const [turi, setTuri] = useState<"kirim" | "chiqim">("kirim");
  const [summaText, setSummaText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [izoh, setIzoh] = useState("");
  const [sana, setSana] = useState(todayDateOnlyString());
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Ochilganda kategoriyalarni yuklaymiz va summaga fokus.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    setError(null);
    setOk(null);
    if (categories === null) {
      fetch("/api/categories")
        .then((r) => (r.ok ? r.json() : []))
        .then((c: CategoryOption[]) => setCategories(c))
        .catch(() => setCategories([]));
    }
    const t = setTimeout(() => amountRef.current?.focus(), 120);
    return () => {
      document.body.style.overflow = "";
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(
    () => (categories ?? []).filter((c) => c.turi === turi),
    [categories, turi]
  );
  const summa = parseSomInput(summaText);

  async function submit() {
    setError(null);
    const catId = categoryId || filtered[0]?.id;
    if (!catId) {
      setError("Kategoriya tanlang");
      return;
    }
    if (summa <= 0) {
      setError("Summani kiriting");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turi, categoryId: catId, summa, sana, izoh: izoh || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setOk(`Saqlandi: ${formatMoney(summa)}`);
      setSummaText("");
      setIzoh("");
      setCategoryId("");
      router.refresh();
      setTimeout(() => {
        setOk(null);
        onClose();
      }, 700);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 animate-fade-in lg:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Tez qo'shish"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface text-fg w-full rounded-t-2xl p-5 pb-safe max-h-[92vh] overflow-y-auto animate-slide-up"
      >
        <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />

        {!kirimOnly ? (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setTuri("kirim"); setCategoryId(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium min-h-[44px] ${
                turi === "kirim" ? "bg-income text-white" : "bg-income-soft text-income-fg"
              }`}
            >
              Kirim
            </button>
            <button
              onClick={() => { setTuri("chiqim"); setCategoryId(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium min-h-[44px] ${
                turi === "chiqim" ? "bg-expense text-white" : "bg-expense-soft text-expense-fg"
              }`}
            >
              Chiqim
            </button>
          </div>
        ) : (
          <div className="mb-4 py-2.5 rounded-lg text-sm font-medium text-center bg-income text-white">
            Kirim (sotuv)
          </div>
        )}

        <input
          ref={amountRef}
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          value={summaText}
          onChange={(e) => setSummaText(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
          placeholder="0"
          aria-label="Summa"
          className="w-full text-center text-2xl font-semibold tnum rounded-xl border border-line bg-surface-2 px-4 py-4 mb-1"
        />
        <p className="text-center text-xs text-faint mb-4">so'm</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {categories === null ? (
            <p className="text-sm text-muted">Kategoriyalar yuklanmoqda…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted">Kategoriya yo'q</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`px-3 py-2 rounded-full text-sm min-h-[40px] border ${
                  categoryId === c.id
                    ? "bg-brand text-white border-transparent"
                    : "bg-surface-2 text-fg border-line"
                }`}
              >
                {c.nomi}
              </button>
            ))
          )}
        </div>

        <input
          type="text"
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          placeholder="Izoh (ixtiyoriy)"
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-3 text-base mb-3"
        />

        {error && <p className="text-expense text-sm mb-2">{error}</p>}
        {ok && <p className="text-income text-sm mb-2">{ok}</p>}

        <div className="sticky bottom-0 bg-surface pt-2 flex gap-2">
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">
            Bekor
          </Button>
          <Button size="lg" loading={loading} onClick={submit} className="flex-[2]">
            Saqlash
          </Button>
        </div>
      </div>
    </div>
  );
}
