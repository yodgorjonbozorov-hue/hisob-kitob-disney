"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionList } from "./TransactionList";
import { SummaryBar } from "./SummaryBar";
import { YangiYozuv } from "./YangiYozuv";
import { ImportExportMenu } from "./ImportExportMenu";
import { ImportModal } from "./ImportModal";
import { BulkAmallar } from "./BulkAmallar";
import { useToast } from "@/components/ui/Toast";
import { isManager } from "@/lib/auth/roles";
import type { TransactionDTO } from "@/lib/queries/transactions";
import type { TezKategoriyalar } from "@/lib/queries/tezKategoriyalar";
import type { Rol } from "@/lib/auth/session";
import type { CategoryOption, FiltrQiymati, XodimOption } from "./turlar";
import { faolFiltrSoni, ozgartirsaBoladi as ozgartirishMumkinmi } from "./turlar";

interface Taqsimot {
  naqd: number;
  click: number;
  karta: number;
}

export function TransactionsClient({
  initialItems,
  initialTotal,
  page,
  pageSize,
  categories,
  accounts,
  masullar = [],
  xodimlar = [],
  tezKategoriyalar,
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
  /** "Kim kiritdi" filtri uchun — faqat direktorga to'ldirilgan holda keladi. */
  xodimlar?: XodimOption[];
  tezKategoriyalar?: TezKategoriyalar;
  currentUserId: string;
  currentUserRol: Rol;
  hideProfit?: boolean;
  moveTargets?: { id: string; nomi: string }[];
  totals: {
    jamiKirim: number;
    jamiChiqim: number;
    sof: number;
    taqsimot: { kirim: Taqsimot; chiqim: Taqsimot; qarz: number };
  };
  /**
   * "Qarzga berilgan" ko'rsatkichi: qarz yozuvlari + kunlik hisobotdagi qarz
   * tushumlari. Sof balansga KIRMAYDI — u alohida ko'rsatiladi.
   */
  qarzSumma?: number | null;
  filters: FiltrQiymati;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // CSV import (Faza 4.4) — faqat boshqaruvchilar uchun.
  const [importOpen, setImportOpen] = useState(false);
  const [yangiOchilsin, setYangiOchilsin] = useState(0);

  // Server ma'lumoti yangilanganda (router.refresh) lokal holatni sinxronlaymiz.
  useEffect(() => setItems(initialItems), [initialItems]);
  useEffect(() => setTotal(initialTotal), [initialTotal]);
  useEffect(() => setSelected(new Set()), [initialItems]);

  const exportUrl = `/api/transactions/export${searchParams.toString() ? `?${searchParams}` : ""}`;
  const manager = isManager(currentUserRol);
  const filtrFaol = faolFiltrSoni(filters) > 0;
  const ozgartirsaBoladi = useMemo(
    () => (t: TransactionDTO) => ozgartirishMumkinmi(t, currentUserId, manager),
    [currentUserId, manager]
  );

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

  /** Ommaviy amal boshlanganda ro'yxatni darhol qisqartiramiz. */
  function bulkOptimistik(ids: string[]) {
    const toplam = new Set(ids);
    setItems((prev) => prev.filter((i) => !toplam.has(i.id)));
    setTotal((prev) => Math.max(0, prev - ids.length));
    setSelected(new Set());
  }

  /** Yangi yozuv. `t === null` — tasdiqlash so'rovi yaratilgan (yozuv hali yo'q). */
  function handleCreated(t: TransactionDTO | null, xabar: string) {
    if (t) {
      setItems((prev) => [t, ...prev]);
      setTotal((prev) => prev + 1);
    }
    toast({ message: t ? `✓ ${xabar}` : xabar, tone: "success" });
    router.refresh();
  }

  function handleUpdated(t: TransactionDTO) {
    setItems((prev) => prev.map((i) => (i.id === t.id ? t : i)));
    toast({ message: "Yozuv yangilandi", tone: "success" });
    router.refresh();
  }

  // Optimistik o'chirish + 5s "Qaytarish" (undo). Soft-delete, keyin undo → restore.
  async function handleDelete(t: TransactionDTO) {
    setItems((prev) => prev.filter((i) => i.id !== t.id));
    setTotal((prev) => Math.max(0, prev - 1));
    try {
      const res = await fetch(`/api/transactions/${t.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setItems((prev) => [t, ...prev]);
        setTotal((prev) => prev + 1);
        toast({ message: data?.error ?? "O'chirib bo'lmadi", tone: "error" });
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

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Kirim va chiqimlar</h1>
        <div className="flex items-center gap-2">
          <YangiYozuv
            ochSignal={yangiOchilsin}
            categories={categories}
            accounts={accounts}
            masullar={masullar}
            tezKategoriyalar={tezKategoriyalar}
            onCreated={handleCreated}
            onQarzCreated={() => {
              toast({ message: "Qarz yozildi — balans o'zgarmadi", tone: "success" });
              router.refresh();
            }}
          />
          <ImportExportMenu
            exportUrl={exportUrl}
            onImport={manager ? () => setImportOpen(true) : undefined}
          />
        </div>
      </div>

      <SummaryBar
        jamiKirim={totals.jamiKirim}
        jamiChiqim={totals.jamiChiqim}
        sof={totals.sof}
        kirimTaqsimot={totals.taqsimot.kirim}
        chiqimTaqsimot={totals.taqsimot.chiqim}
        qarzSumma={qarzSumma}
        hideProfit={hideProfit}
        turiFiltri={filters.turi}
      />

      <TransactionFilters categories={categories} xodimlar={xodimlar} initial={filters} />

      <BulkAmallar
        selected={selected}
        total={total}
        moveTargets={moveTargets}
        onOptimistik={bulkOptimistik}
      />

      <TransactionList
        items={items}
        total={total}
        page={page}
        pageSize={pageSize}
        categories={categories}
        ozgartirsaBoladi={ozgartirsaBoladi}
        filtrFaol={filtrFaol}
        onUpdated={handleUpdated}
        onDelete={handleDelete}
        onYangi={() => setYangiOchilsin((n) => n + 1)}
        onFiltrTozalash={() => router.push(pathname)}
        selected={selected}
        onToggleSelect={toggleSelect}
        onToggleAll={toggleAll}
      />
    </div>
  );
}
