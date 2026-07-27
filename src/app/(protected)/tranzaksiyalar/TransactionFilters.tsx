"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { formatSom, parseSomInput } from "@/lib/format";

interface CategoryOption {
  id: string;
  nomi: string;
  turi: string;
}

interface FiltersValue {
  from: string;
  to: string;
  turi: string;
  categoryId: string;
  q: string;
  minSumma: string;
  maxSumma: string;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Sana preseti → { from, to } (mahalliy vaqt bo'yicha). */
function presetRange(key: string): { from: string; to: string } {
  const now = new Date();
  const today = ymd(now);
  if (key === "bugun") return { from: today, to: today };
  if (key === "hafta") {
    const day = (now.getDay() + 6) % 7; // Dushanba = 0
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    return { from: ymd(start), to: today };
  }
  if (key === "oy") return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: today };
  if (key === "otganOy") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: ymd(first), to: ymd(last) };
  }
  if (key === "chorak") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: `${now.getFullYear()}-${pad(q * 3 + 1)}-01`, to: today };
  }
  if (key === "yil") return { from: `${now.getFullYear()}-01-01`, to: today };
  return { from: "", to: "" };
}

const PRESETS = [
  { key: "bugun", label: "Bugun" },
  { key: "hafta", label: "Bu hafta" },
  { key: "oy", label: "Bu oy" },
  { key: "otganOy", label: "O'tgan oy" },
  { key: "chorak", label: "Chorak" },
  { key: "yil", label: "Yil" },
];

export function TransactionFilters({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  initial: FiltersValue;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [values, setValues] = useState(initial);
  const [showMore, setShowMore] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => setValues(initial), [initial]);

  function applyFilters(next: FiltersValue) {
    const params = new URLSearchParams();
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.turi) params.set("turi", next.turi);
    if (next.categoryId) params.set("categoryId", next.categoryId);
    if (next.q) params.set("q", next.q);
    if (next.minSumma) params.set("minSumma", String(parseSomInput(next.minSumma)));
    if (next.maxSumma) params.set("maxSumma", String(parseSomInput(next.maxSumma)));
    router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
  }

  function update(patch: Partial<FiltersValue>, immediate = true) {
    const next = { ...values, ...patch };
    setValues(next);
    if (immediate) applyFilters(next);
  }

  function clearAll() {
    const cleared = { from: "", to: "", turi: "", categoryId: "", q: "", minSumma: "", maxSumma: "" };
    setValues(cleared);
    router.push(pathname);
  }

  // Qidiruv (q) va summa uchun debounce.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const t = setTimeout(() => applyFilters(values), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.q, values.minSumma, values.maxSumma]);

  const turiFilter = values.turi;
  const filteredCategories = turiFilter ? categories.filter((c) => c.turi === turiFilter) : categories;
  const activeCount = [values.from, values.to, values.turi, values.categoryId, values.q, values.minSumma, values.maxSumma].filter(Boolean).length;

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-line p-4 space-y-3">
      {/* Sana presetlari */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const r = presetRange(p.key);
          const active = values.from === r.from && values.to === r.to;
          return (
            <button
              key={p.key}
              onClick={() => update(presetRange(p.key))}
              className={`px-3 py-1.5 rounded-full text-sm min-h-[36px] border ${
                active ? "bg-brand text-white border-transparent" : "bg-surface-2 text-fg border-line"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowMore((s) => !s)}
          className="px-3 py-1.5 rounded-full text-sm min-h-[36px] border border-line text-muted hover:text-fg"
        >
          {showMore ? "Kamroq ▲" : "Ko'proq ▾"}
        </button>
      </div>

      {/* Qidiruv */}
      <input
        type="text"
        value={values.q}
        onChange={(e) => update({ q: e.target.value }, false)}
        placeholder="Izoh bo'yicha qidirish..."
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base"
      />

      {showMore && (
        <div className="flex flex-wrap gap-3 items-end pt-1">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Sanadan</label>
            <input type="date" value={values.from} onChange={(e) => update({ from: e.target.value })} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Sanagacha</label>
            <input type="date" value={values.to} onChange={(e) => update({ to: e.target.value })} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Turi</label>
            <select value={values.turi} onChange={(e) => update({ turi: e.target.value, categoryId: "" })} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
              <option value="">Barchasi</option>
              <option value="kirim">Kirim</option>
              <option value="chiqim">Chiqim</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Kategoriya</label>
            <select value={values.categoryId} onChange={(e) => update({ categoryId: e.target.value })} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
              <option value="">Barchasi</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.nomi}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Summa (dan)</label>
            <input type="text" inputMode="numeric" value={values.minSumma} onChange={(e) => update({ minSumma: e.target.value ? formatSom(parseSomInput(e.target.value)) : "" }, false)} placeholder="0" className="w-28 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm tnum" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Summa (gacha)</label>
            <input type="text" inputMode="numeric" value={values.maxSumma} onChange={(e) => update({ maxSumma: e.target.value ? formatSom(parseSomInput(e.target.value)) : "" }, false)} placeholder="∞" className="w-28 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm tnum" />
          </div>
        </div>
      )}

      {activeCount > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted">{activeCount} ta filtr faol</span>
          <button onClick={clearAll} className="text-xs font-medium text-expense hover:underline">
            Hammasini tozalash
          </button>
        </div>
      )}
    </div>
  );
}
