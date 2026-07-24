"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

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
}

export function TransactionFilters({
  categories,
  initial,
  kirimOnly = false,
}: {
  categories: CategoryOption[];
  initial: FiltersValue;
  kirimOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [values, setValues] = useState(initial);
  const isFirstRender = useRef(true);

  function applyFilters(next: FiltersValue) {
    const params = new URLSearchParams();
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.turi) params.set("turi", next.turi);
    if (next.categoryId) params.set("categoryId", next.categoryId);
    if (next.q) params.set("q", next.q);
    router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
  }

  function update(patch: Partial<FiltersValue>) {
    const next = { ...values, ...patch };
    setValues(next);
    if (patch.q === undefined) {
      applyFilters(next);
    }
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => applyFilters(values), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.q]);

  const turiFilter = kirimOnly ? "kirim" : values.turi;
  const filteredCategories = turiFilter ? categories.filter((c) => c.turi === turiFilter) : categories;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Sanadan</label>
        <input
          type="date"
          value={values.from}
          onChange={(e) => update({ from: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Sanagacha</label>
        <input
          type="date"
          value={values.to}
          onChange={(e) => update({ to: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      {!kirimOnly && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Turi</label>
          <select
            value={values.turi}
            onChange={(e) => update({ turi: e.target.value, categoryId: "" })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">Barchasi</option>
            <option value="kirim">Kirim</option>
            <option value="chiqim">Chiqim</option>
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Kategoriya</label>
        <select
          value={values.categoryId}
          onChange={(e) => update({ categoryId: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">Barchasi</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nomi}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-slate-500 mb-1">Izoh bo'yicha qidirish</label>
        <input
          type="text"
          value={values.q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="Qidirish..."
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
    </div>
  );
}
