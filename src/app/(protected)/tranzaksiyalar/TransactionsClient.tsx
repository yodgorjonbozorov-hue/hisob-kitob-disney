"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TransactionForm } from "./TransactionForm";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionList } from "./TransactionList";
import type { TransactionDTO } from "@/lib/queries/transactions";
import type { Rol } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";

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
  filters: { from: string; to: string; turi: string; categoryId: string; q: string };
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);

  function handleCreated(t: TransactionDTO) {
    setItems((prev) => [t, ...prev]);
    setTotal((prev) => prev + 1);
    router.refresh();
  }

  function handleUpdated(t: TransactionDTO) {
    setItems((prev) => prev.map((i) => (i.id === t.id ? t : i)));
    router.refresh();
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <TransactionForm categories={categories} onCreated={handleCreated} kirimOnly={kirimOnly} />
      <TransactionFilters categories={categories} initial={filters} kirimOnly={kirimOnly} />
      <TransactionList
        items={items}
        total={total}
        page={page}
        pageSize={pageSize}
        categories={categories}
        currentUserId={currentUserId}
        currentUserRol={currentUserRol}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
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
                <span className="font-semibold text-fg">
                  Sof: {formatMoney(totals.sof)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
