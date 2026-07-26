"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatSom } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import { Button } from "@/components/ui/Button";
import { NumberPad } from "@/components/ui/NumberPad";
import { CategoryPicker } from "@/components/ui/CategoryPicker";
import { useToast } from "@/components/ui/Toast";
import type { Rol } from "@/lib/auth/session";

interface CategoryOption {
  id: string;
  nomi: string;
  turi: string;
}

/**
 * Tez qo'shish (REDESIGN.md 5.1) — FAB dan ochiladi. 3 qadam: katta keypad'da summa
 * → ikonkali kategoriya to'ri → Saqlash. Sotuvchi uchun faqat kirim.
 */
export function QuickAddSheet({
  open,
  onClose,
  rol,
  defaultTuri = "kirim",
}: {
  open: boolean;
  onClose: () => void;
  rol: Rol;
  defaultTuri?: "kirim" | "chiqim";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const kirimOnly = rol === "sotuvchi";
  const [turi, setTuri] = useState<"kirim" | "chiqim">("kirim");
  const [summa, setSumma] = useState(0);
  const [categoryId, setCategoryId] = useState("");
  const [izoh, setIzoh] = useState("");
  const [kecha, setKecha] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    setError(null);
    setSumma(0);
    setCategoryId("");
    setIzoh("");
    setKecha(false);
    setTuri(kirimOnly ? "kirim" : defaultTuri);
    if (categories === null) {
      fetch("/api/categories").then((r) => (r.ok ? r.json() : [])).then(setCategories).catch(() => setCategories([]));
    }
    return () => { document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => (categories ?? []).filter((c) => c.turi === turi), [categories, turi]);

  async function submit() {
    setError(null);
    const catId = categoryId || filtered[0]?.id;
    if (summa <= 0) return setError("Summani kiriting");
    if (!catId) return setError("Kategoriya tanlang");
    setLoading(true);
    try {
      const sana = kecha
        ? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
        : todayDateOnlyString();
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turi, categoryId: catId, summa, sana, izoh: izoh || undefined }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Xatolik yuz berdi");
      router.refresh();
      onClose();
      toast({
        message: `Yozildi · ${formatSom(summa)} soʻm`,
        tone: turi === "kirim" ? "success" : "neutral",
        action: data.id
          ? { label: "Bekor qilish", onClick: async () => { await fetch(`/api/transactions/${data.id}`, { method: "DELETE" }); router.refresh(); } }
          : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 animate-fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div onClick={(e) => e.stopPropagation()} className="bg-app text-fg w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl pb-safe max-h-[94vh] overflow-y-auto animate-slide-up">
        <div className="w-10 h-1 rounded-full bg-line-strong mx-auto my-3" />

        {/* Katta summa */}
        <div className="px-5 text-center">
          <p className={`font-display text-3xl tnum ${turi === "kirim" ? "text-income" : "text-expense"}`}>
            {formatSom(summa)} <span className="text-lg text-faint font-sans">soʻm</span>
          </p>
        </div>

        {/* Kirim / Chiqim */}
        {!kirimOnly ? (
          <div className="flex gap-2 px-5 mt-3">
            <button onClick={() => { setTuri("kirim"); setCategoryId(""); }} className={`flex-1 h-11 rounded-lg text-sm font-medium ${turi === "kirim" ? "bg-income text-white" : "bg-income-soft text-income-fg"}`}>Pul kirdi</button>
            <button onClick={() => { setTuri("chiqim"); setCategoryId(""); }} className={`flex-1 h-11 rounded-lg text-sm font-medium ${turi === "chiqim" ? "bg-expense text-white" : "bg-expense-soft text-expense-fg"}`}>Pul chiqdi</button>
          </div>
        ) : (
          <div className="px-5 mt-3"><div className="h-11 rounded-lg bg-income text-white text-sm font-medium flex items-center justify-center">Pul kirdi (sotuv)</div></div>
        )}

        <div className="px-5 mt-4">
          <NumberPad value={summa} onChange={setSumma} tone={turi === "kirim" ? "income" : "expense"} />
        </div>

        {/* Kategoriya */}
        <div className="px-5 mt-4">
          {categories === null ? (
            <p className="text-sm text-muted">Kategoriyalar yuklanmoqda…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted">Kategoriya yo'q</p>
          ) : (
            <CategoryPicker categories={filtered} value={categoryId} onChange={setCategoryId} />
          )}
        </div>

        {/* Izoh + sana */}
        <div className="px-5 mt-3 flex gap-2 items-center">
          <input type="text" value={izoh} onChange={(e) => setIzoh(e.target.value)} placeholder="Izoh (ixtiyoriy)" className="flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-base" />
          <button onClick={() => setKecha((k) => !k)} className={`shrink-0 h-11 px-3 rounded-lg text-sm font-medium border ${kecha ? "bg-brand-wash text-brand border-brand" : "bg-surface text-muted border-line"}`}>
            {kecha ? "Kecha" : "Bugun"} ▾
          </button>
        </div>

        {error && <p className="px-5 mt-2 text-expense text-sm">{error}</p>}

        <div className="sticky bottom-0 bg-app px-5 py-3 mt-3 flex gap-2 border-t border-line">
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">Bekor</Button>
          <Button size="lg" loading={loading} onClick={submit} className={`flex-[2] ${turi === "chiqim" ? "bg-expense" : ""}`}>Saqlash</Button>
        </div>
      </div>
    </div>
  );
}
