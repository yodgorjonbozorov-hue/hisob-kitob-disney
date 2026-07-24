"use client";

import { useState, useMemo, FormEvent } from "react";
import { formatSom, parseSomInput } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import { Button } from "@/components/ui/Button";
import type { TransactionDTO } from "@/lib/queries/transactions";

interface CategoryOption {
  id: string;
  nomi: string;
  turi: string;
}

export function TransactionForm({
  categories,
  onCreated,
  kirimOnly = false,
}: {
  categories: CategoryOption[];
  onCreated: (t: TransactionDTO) => void;
  kirimOnly?: boolean;
}) {
  const [turi, setTuri] = useState<"kirim" | "chiqim">("kirim");
  const [categoryId, setCategoryId] = useState("");
  const [summaText, setSummaText] = useState("");
  const [sana, setSana] = useState(todayDateOnlyString());
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.turi === turi),
    [categories, turi]
  );

  function handleSummaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const numeric = parseSomInput(e.target.value);
    setSummaText(numeric ? formatSom(numeric) : "");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const summa = parseSomInput(summaText);
    const catId = categoryId || filteredCategories[0]?.id;
    if (!catId) {
      setError("Kategoriya tanlanmagan");
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
        setLoading(false);
        return;
      }
      onCreated(data);
      setSummaText("");
      setIzoh("");
      setCategoryId("");
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-2xl shadow-sm border border-line p-5 space-y-4">
      {kirimOnly ? (
        <div className="py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white text-center">
          Kirim (sotuv)
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTuri("kirim");
              setCategoryId("");
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              turi === "kirim" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-income-fg"
            }`}
          >
            Kirim
          </button>
          <button
            type="button"
            onClick={() => {
              setTuri("chiqim");
              setCategoryId("");
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              turi === "chiqim" ? "bg-rose-600 text-white" : "bg-rose-50 text-expense-fg"
            }`}
          >
            Chiqim
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Kategoriya</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          >
            <option value="">Tanlang...</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nomi}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Summa (so'm)</label>
          <input
            type="text"
            inputMode="numeric"
            value={summaText}
            onChange={handleSummaChange}
            placeholder="0"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Sana</label>
          <input
            type="date"
            value={sana}
            onChange={(e) => setSana(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Izoh (ixtiyoriy)</label>
          <input
            type="text"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-expense text-sm">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saqlanmoqda..." : "Qo'shish"}
      </Button>
    </form>
  );
}
