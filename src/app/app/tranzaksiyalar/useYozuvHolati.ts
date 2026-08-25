"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { TransactionDTO } from "@/lib/queries/transactions";

/**
 * SAHIFADAGI YOZUVLAR HOLATI — ro'yxat, sanoq, belgilanganlar va ularni
 * o'zgartiruvchi amallar (qo'shish / tahrirlash / o'chirish).
 *
 * Alohida hook: bu mantiq ikkala ko'rinishga (kategoriya kesimi va tekis
 * ro'yxat) BIR XIL kerak, `TransactionsClient` esa u bilan birga 250
 * satrdan oshib ketardi (CLAUDE.md kod qoidalari).
 *
 * Amallar OPTIMISTIK: ro'yxat darhol yangilanadi, keyin server javobi
 * bilan solishtiriladi. Xato bo'lsa yozuv joyiga QAYTARILADI — kassir
 * "o'chdi shekilli" deb ikkinchi marta bosmasligi kerak.
 */
export function useYozuvHolati(initialItems: TransactionDTO[], initialTotal: number) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Kategoriya ko'rinishidagi yuklangan bo'laklarni bekor qilish belgisi. */
  const [yangilanish, setYangilanish] = useState(0);

  // Server ma'lumoti yangilanganda (router.refresh) lokal holatni sinxronlaymiz.
  useEffect(() => setItems(initialItems), [initialItems]);
  useEffect(() => setTotal(initialTotal), [initialTotal]);
  useEffect(() => setSelected(new Set()), [initialItems]);

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
    setYangilanish((n) => n + 1);
  }

  /** Yangi yozuv. `t === null` — tasdiqlash so'rovi yaratilgan (yozuv hali yo'q). */
  function handleCreated(t: TransactionDTO | null, xabar: string) {
    if (t) {
      setItems((prev) => [t, ...prev]);
      setTotal((prev) => prev + 1);
    }
    toast({ message: t ? `✓ ${xabar}` : xabar, tone: "success" });
    setYangilanish((n) => n + 1);
    router.refresh();
  }

  function handleUpdated(t: TransactionDTO) {
    setItems((prev) => prev.map((i) => (i.id === t.id ? t : i)));
    toast({ message: "Yozuv yangilandi", tone: "success" });
    setYangilanish((n) => n + 1);
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
      setYangilanish((n) => n + 1);
      router.refresh();
      toast({
        message: "Tranzaksiya o'chirildi",
        tone: "success",
        action: {
          label: "Qaytarish",
          onClick: async () => {
            await fetch(`/api/transactions/${t.id}/restore`, { method: "POST" });
            setYangilanish((n) => n + 1);
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

  return {
    items,
    total,
    selected,
    yangilanish,
    toggleSelect,
    toggleAll,
    bulkOptimistik,
    handleCreated,
    handleUpdated,
    handleDelete,
  };
}
