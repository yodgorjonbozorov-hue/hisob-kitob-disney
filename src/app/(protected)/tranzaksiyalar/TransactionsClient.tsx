"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TransactionForm } from "./TransactionForm";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionList } from "./TransactionList";
import type { TransactionDTO } from "@/lib/queries/transactions";

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
  filters,
}: {
  initialItems: TransactionDTO[];
  initialTotal: number;
  page: number;
  pageSize: number;
  categories: CategoryOption[];
  currentUserId: string;
  currentUserRol: "admin" | "kassir";
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
      <TransactionForm categories={categories} onCreated={handleCreated} />
      <TransactionFilters categories={categories} initial={filters} />
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
    </div>
  );
}
