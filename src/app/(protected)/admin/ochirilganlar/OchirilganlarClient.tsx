"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatSomLabel, formatDateUZ } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

interface DeletedItem {
  id: string;
  turi: string;
  summa: number;
  categoryNomi: string;
  userIsm: string;
  sana: string;
  deletedAt: string | null;
}

export function OchirilganlarClient({ initialItems }: { initialItems: DeletedItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState<string | null>(null);

  async function restore(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/transactions/${id}/restore`, { method: "POST" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        toast({ message: "Tiklandi", tone: "success" });
        router.refresh();
      } else {
        toast({ message: "Tiklab bo'lmadi", tone: "error" });
      }
    } finally {
      setBusy(null);
    }
  }

  async function permanentDelete(id: string) {
    if (!confirm("Butunlay o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/transactions/${id}?permanent=true`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        toast({ message: "Butunlay o'chirildi", tone: "neutral" });
        router.refresh();
      } else {
        toast({ message: "O'chirib bo'lmadi", tone: "error" });
      }
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState title="Savat bo'sh" description="O'chirilgan tranzaksiyalar bu yerda ko'rinadi." icon="🗑" />
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="divide-y divide-line">
        {items.map((t) => (
          <div key={t.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone={t.turi === "kirim" ? "kirim" : "chiqim"}>
                  {t.turi === "kirim" ? "Kirim" : "Chiqim"}
                </Badge>
                <span className="font-medium text-fg">{t.categoryNomi}</span>
                <span className={`tnum font-semibold ${t.turi === "kirim" ? "text-income" : "text-expense"}`}>
                  {formatSomLabel(t.summa)}
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                {formatDateUZ(new Date(t.sana))} · {t.userIsm}
                {t.deletedAt ? ` · o'chirilgan: ${formatDateUZ(new Date(t.deletedAt))}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => restore(t.id)}
                disabled={busy === t.id}
                className="text-sm font-medium text-income hover:underline disabled:opacity-50 min-h-[40px] px-2"
              >
                Tiklash
              </button>
              <button
                onClick={() => permanentDelete(t.id)}
                disabled={busy === t.id}
                className="text-sm font-medium text-expense hover:underline disabled:opacity-50 min-h-[40px] px-2"
              >
                Butunlay o'chirish
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
