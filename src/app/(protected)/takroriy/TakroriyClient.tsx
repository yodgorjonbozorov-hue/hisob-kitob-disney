"use client";

import { useState, useMemo, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

interface Cat { id: string; nomi: string; turi: string }
interface Rec {
  id: string; turi: string; summa: number; kun: number; izoh: string | null;
  isActive: boolean; categoryNomi: string; lastGenerated: string | null;
}

export function TakroriyClient({ categories, initial }: { categories: Cat[]; initial: Rec[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState(initial);
  const [turi, setTuri] = useState<"kirim" | "chiqim">("chiqim");
  const [categoryId, setCategoryId] = useState("");
  const [summa, setSumma] = useState("");
  const [kun, setKun] = useState("1");
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);

  const cats = useMemo(() => categories.filter((c) => c.turi === turi), [categories, turi]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const catId = categoryId || cats[0]?.id;
    const s = parseSomInput(summa);
    const k = parseInt(kun, 10);
    if (!catId || s <= 0 || !k) {
      toast({ message: "Kategoriya, summa va kunni to'ldiring", tone: "error" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: catId, turi, summa: s, kun: k, izoh: izoh || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setRows((p) => [data, ...p]);
        setSumma(""); setIzoh(""); setCategoryId("");
        toast({ message: "Qo'shildi", tone: "success" });
        router.refresh();
      } else {
        toast({ message: data.error ?? "Xatolik", tone: "error" });
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggle(r: Rec) {
    const res = await fetch(`/api/recurring/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !r.isActive }),
    });
    if (res.ok) setRows((p) => p.map((x) => (x.id === r.id ? { ...x, isActive: !x.isActive } : x)));
  }

  async function remove(r: Rec) {
    if (!confirm("O'chirilsinmi?")) return;
    const res = await fetch(`/api/recurring/${r.id}`, { method: "DELETE" });
    if (res.ok) setRows((p) => p.filter((x) => x.id !== r.id));
  }

  async function generateNow() {
    const res = await fetch("/api/recurring/generate", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      toast({ message: data.count > 0 ? `${data.count} ta yozuv yaratildi` : "Yaratish uchun yozuv yo'q", tone: "success" });
      router.refresh();
    } else {
      toast({ message: "Xatolik", tone: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold text-fg mb-3">Yangi takroriy</h2>
        <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={() => { setTuri("kirim"); setCategoryId(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${turi === "kirim" ? "bg-income text-white" : "bg-income-soft text-income-fg"}`}>Kirim</button>
            <button type="button" onClick={() => { setTuri("chiqim"); setCategoryId(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${turi === "chiqim" ? "bg-expense text-white" : "bg-expense-soft text-expense-fg"}`}>Chiqim</button>
          </div>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            <option value="">Kategoriya...</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nomi}</option>)}
          </select>
          <input type="text" inputMode="numeric" value={summa} onChange={(e) => setSumma(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")} placeholder="Summa" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm tnum" />
          <div>
            <label className="block text-xs text-muted mb-1">Oyning kuni (1-28)</label>
            <input type="number" min={1} max={28} value={kun} onChange={(e) => setKun(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
          </div>
          <input type="text" value={izoh} onChange={(e) => setIzoh(e.target.value)} placeholder="Izoh (masalan: Ijara)" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
          <div className="sm:col-span-2">
            <Button type="submit" loading={loading}>Qo'shish</Button>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <Card><EmptyState title="Takroriy yozuv yo'q" description="Har oy avtomatik yaratiladigan yozuv qo'shing." icon="🔁" /></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="text-sm text-muted">Har oy avtomatik (yoki qo'lda) yaratiladi</span>
            <button onClick={generateNow} className="text-sm font-medium text-brand hover:underline">
              Hozir yaratish
            </button>
          </div>
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <div key={r.id} className={`px-5 py-3 flex items-center justify-between gap-3 ${r.isActive ? "" : "opacity-50"}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={r.turi === "kirim" ? "kirim" : "chiqim"}>{r.turi === "kirim" ? "Kirim" : "Chiqim"}</Badge>
                    <span className="font-medium text-fg">{r.categoryNomi}</span>
                    <span className={`tnum font-semibold ${r.turi === "kirim" ? "text-income" : "text-expense"}`}>{formatSomLabel(r.summa)}</span>
                  </div>
                  <p className="text-xs text-muted mt-1">Har oy {r.kun}-kun{r.izoh ? ` · ${r.izoh}` : ""}{r.lastGenerated ? ` · oxirgi: ${r.lastGenerated}` : ""}</p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => toggle(r)} className="text-xs font-medium text-muted hover:text-fg">{r.isActive ? "To'xtatish" : "Yoqish"}</button>
                  <button onClick={() => remove(r)} className="text-xs font-medium text-expense hover:underline">O'chirish</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
