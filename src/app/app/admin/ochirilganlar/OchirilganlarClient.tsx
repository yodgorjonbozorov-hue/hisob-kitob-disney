"use client";

/**
 * SAVAT — bekor qilingan (yumshoq o'chirilgan) tranzaksiyalar.
 *
 * "Butunlay o'chirish" tugmasi OLIB TASHLANDI (audit: Critical #3): moliyaviy
 * yozuvni bazadan yo'q qilish audit izini ham, tiklash imkonini ham
 * yo'qotardi. Yozuv shu yerda qoladi va istalgan paytda tiklanadi.
 */

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

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Savat bo'sh"
          description="Bekor qilingan tranzaksiyalar bu yerda ko'rinadi va tiklanishi mumkin."
          icon="🗑"
        />
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
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
