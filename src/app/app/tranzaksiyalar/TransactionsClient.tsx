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
import { ImportModal } from "./ImportModal";

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
  accounts,
  masullar = [],
  currentUserId,
  currentUserRol,
  hideProfit = false,
  moveTargets = [],
  totals,
  qarzSumma = null,
  filters,
}: {
  initialItems: TransactionDTO[];
  initialTotal: number;
  page: number;
  pageSize: number;
  categories: CategoryOption[];
  accounts: { id: string; nomi: string }[];
  /** Qarzga mas'ul qilib belgilash mumkin bo'lgan xodimlar. */
  masullar?: { id: string; ism: string }[];
  currentUserId: string;
  currentUserRol: Rol;
  hideProfit?: boolean;
  moveTargets?: { id: string; nomi: string }[];
  totals: {
    jamiKirim: number;
    jamiChiqim: number;
    sof: number;
    naqdKirim: number;
    clickKirim: number;
    qarzKirim: number;
  };
  /**
   * "Qarzga berilgan" ko'rsatkichi: qarz yozuvlari + kunlik hisobotdagi qarz
   * tushumlari. Sof balansga KIRMAYDI — u alohida ko'rsatiladi.
   */
  qarzSumma?: number | null;
  filters: { from: string; to: string; turi: string; categoryId: string; q: string; minSumma: string; maxSumma: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // CSV import (Faza 4.4) — faqat boshqaruvchilar uchun.
  const [importOpen, setImportOpen] = useState(false);

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

  async function bulkMove(targetBusinessId: string) {
    const ids = Array.from(selected);
    if (ids.length === 0 || !targetBusinessId) return;
    const target = moveTargets.find((b) => b.id === targetBusinessId);
    if (!confirm(`${ids.length} ta yozuv "${target?.nomi}" biznesiga ko'chirilsinmi?`)) return;
    setItems((prev) => prev.filter((i) => !selected.has(i.id)));
    setTotal((prev) => Math.max(0, prev - ids.length));
    setSelected(new Set());
    const res = await fetch("/api/transactions/bulk-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, targetBusinessId }),
    });
    if (res.ok) {
      const data = await res.json();
      toast({ message: `${data.moved} ta yozuv "${target?.nomi}" ga ko'chirildi`, tone: "success" });
      router.refresh();
    } else {
      toast({ message: (await res.json()).error ?? "Ko'chirib bo'lmadi", tone: "error" });
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
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
      <TransactionForm
        categories={categories}
        accounts={accounts}
        masullar={masullar}
        onCreated={handleCreated}
        // Qarz tranzaksiya EMAS — ro'yxatga qo'shilmaydi, lekin "Qarzga
        // berilgan" ko'rsatkichi serverdan qayta o'qiladi.
        onQarzCreated={() => {
          toast({ message: "Qarz yozildi — balans o'zgarmadi", tone: "success" });
          router.refresh();
        }}
      />

      {moveTargets !== undefined && currentUserRol !== "CASHIER" && currentUserRol !== "SELLER" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="text-sm text-brand hover:underline"
          >
            CSV import
          </button>
        </div>
      )}

      <TransactionFilters categories={categories} initial={filters} />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          {selected.size > 0 ? `${selected.size} ta tanlandi` : `${total} ta yozuv`}
        </span>
        <div className="flex items-center gap-3">
          {selected.size > 0 && moveTargets.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) bulkMove(e.target.value); e.target.value = ""; }}
              className="text-sm rounded-lg border border-line bg-surface px-2 py-1 text-brand font-medium"
              aria-label="Boshqa biznesga ko'chirish"
            >
              <option value="">Ko'chirish →</option>
              {moveTargets.map((b) => (
                <option key={b.id} value={b.id}>{b.nomi}</option>
              ))}
            </select>
          )}
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

      {/* Filtrlangan jami — sticky footer (mobil'da pastki nav ustida).
          Tushum BO'LIMLARI alohida qatorlarda: Naqd (naqd kassa), Click
          (plastik/bank kassa), Qarz (kunlik hisobot qarz tushumlari). */}
      <div className="sticky bottom-[4.75rem] lg:bottom-3 z-30">
        <div className="bg-surface/95 backdrop-blur border border-line rounded-xl shadow-card px-4 py-2.5 space-y-1.5">
          <div className="space-y-1 text-sm tnum">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">💵 Naqd (so&apos;m)</span>
              <span className="font-medium text-fg">{formatMoney(totals.naqdKirim)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">💳 Click</span>
              <span className="font-medium text-fg">{formatMoney(totals.clickKirim)}</span>
            </div>
            {qarzSumma !== null && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted">📋 Qarz</span>
                <span className="font-medium text-fg">{formatMoney(qarzSumma)}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 pt-1.5 border-t border-line">
            <span className="text-sm text-muted tnum">{total} ta yozuv</span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm tnum">
              <span className="text-income font-medium">+ {formatMoney(totals.jamiKirim)}</span>
              <span className="text-expense font-medium">− {formatMoney(totals.jamiChiqim)}</span>
              {!hideProfit && (
                <span className="font-semibold text-fg">Sof: {formatMoney(totals.sof)}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
