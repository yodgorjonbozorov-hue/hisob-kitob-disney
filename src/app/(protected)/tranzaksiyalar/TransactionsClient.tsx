"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TransactionForm } from "./TransactionForm";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionList } from "./TransactionList";
import type { TransactionDTO } from "@/lib/queries/transactions";
import type { Rol } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

interface CategoryOption {
  id: string;
  nomi: string;
  turi: string;
}

export function TransactionsClient({
  initialItems,
  initialTotal,
  page,
  pageSize,
  categories,
  currentUserId,
  currentUserRol,
  kirimOnly = false,
  totals,
  filters,
}: {
  initialItems: TransactionDTO[];
  initialTotal: number;
  page: number;
  pageSize: number;
  categories: CategoryOption[];
  currentUserId: string;
  currentUserRol: Rol;
  kirimOnly?: boolean;
  totals: { jamiKirim: number; jamiChiqim: number; sof: number };
  filters: { from: string; to: string; turi: string; categoryId: string; q: string; minSumma: string; maxSumma: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Server ma'lumoti yangilanganda (router.refresh) lokal holatni sinxronlaymiz.
  useEffect(() => setItems(initialItems), [initialItems]);
  useEffect(() => setTotal(initialTotal), [initialTotal]);
  useEffect(() => setSelected(new Set()), [initialItems]);

  const exportUrl = `/api/transactions/export${searchParams.toString() ? `?${searchParams}` : ""}`;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setItems((prev) => prev.filter((i) => !selected.has(i.id)));
    setTotal((prev) => Math.max(0, prev - ids.length));
    setSelected(new Set());
    const res = await fetch("/api/transactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      const data = await res.json();
      toast({ message: `${data.deleted} ta yozuv o'chirildi`, tone: "success" });
      router.refresh();
    } else {
      toast({ message: "O'chirib bo'lmadi", tone: "error" });
      router.refresh();
    }
  }

  function handleCreated(t: TransactionDTO) {
    setItems((prev) => [t, ...prev]);
    setTotal((prev) => prev + 1);
    router.refresh();
  }

  function handleUpdated(t: TransactionDTO) {
    setItems((prev) => prev.map((i) => (i.id === t.id ? t : i)));
    router.refresh();
  }

  // Optimistik o'chirish + 5s "Qaytarish" (undo). Soft-delete, keyin undo → restore.
  async function handleDelete(t: TransactionDTO) {
    setItems((prev) => prev.filter((i) => i.id !== t.id));
    setTotal((prev) => Math.max(0, prev - 1));
    try {
      const res = await fetch(`/api/transactions/${t.id}`, { method: "DELETE" });
      if (!res.ok) {
        // Muvaffaqiyatsiz — qaytaramiz.
        setItems((prev) => [t, ...prev]);
        setTotal((prev) => prev + 1);
        toast({ message: "O'chirib bo'lmadi", tone: "error" });
        return;
      }
      router.refresh();
      toast({
        message: "Tranzaksiya o'chirildi",
        tone: "success",
        action: {
          label: "Qaytarish",
          onClick: async () => {
            await fetch(`/api/transactions/${t.id}/restore`, { method: "POST" });
            router.refresh();
          },
        },
      });
    } catch {
      setItems((prev) => [t, ...prev]);
      setTotal((prev) => prev + 1);
      toast({ message: "Serverga ulanib bo'lmadi", tone: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <TransactionForm categories={categories} onCreated={handleCreated} kirimOnly={kirimOnly} />
      <TransactionFilters categories={categories} initial={filters} kirimOnly={kirimOnly} />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          {selected.size > 0 ? `${selected.size} ta tanlandi` : `${total} ta yozuv`}
        </span>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={bulkDelete}
              className="text-sm font-medium text-expense hover:underline"
            >
              O'chirish ({selected.size})
            </button>
          )}
          <a
            href={exportUrl}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            ⬇ Excel
          </a>
        </div>
      </div>

      <TransactionList
        items={items}
        total={total}
        page={page}
        pageSize={pageSize}
        categories={categories}
        currentUserId={currentUserId}
        currentUserRol={currentUserRol}
        onUpdated={handleUpdated}
        onDelete={handleDelete}
        selected={selected}
        onToggleSelect={toggleSelect}
        onToggleAll={toggleAll}
      />

      {/* Filtrlangan jami — sticky footer (mobil'da pastki nav ustida) */}
      <div className="sticky bottom-[4.75rem] lg:bottom-3 z-30">
        <div className="bg-surface/95 backdrop-blur border border-line rounded-xl shadow-card px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <span className="text-sm text-muted tnum">{total} ta yozuv</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm tnum">
            <span className="text-income font-medium">+ {formatMoney(totals.jamiKirim)}</span>
            {!kirimOnly && (
              <>
                <span className="text-expense font-medium">− {formatMoney(totals.jamiChiqim)}</span>
                <span className="font-semibold text-fg">Sof: {formatMoney(totals.sof)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
