"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import type { BudgetRow } from "@/lib/queries/budget";

export function BudjetClient({ rows, month }: { rows: BudgetRow[]; month: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.categoryId, r.limitSumma ? formatSom(r.limitSumma) : ""]))
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function save(categoryId: string) {
    const limitSumma = parseSomInput(edits[categoryId] ?? "");
    setSaving(categoryId);
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, oy: month, limitSumma }),
      });
      if (res.ok) {
        toast({ message: limitSumma > 0 ? "Limit saqlandi" : "Limit o'chirildi", tone: "success" });
        router.refresh();
      } else {
        toast({ message: (await res.json()).error ?? "Xatolik", tone: "error" });
      }
    } finally {
      setSaving(null);
    }
  }

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Chiqim kategoriyasi yo'q"
          description="Budjet qo'yish uchun avval Admin → Kategoriyalar bo'limida chiqim kategoriyalari qo'shing."
          icon="📊"
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const over = r.limitSumma > 0 && r.sarflangan > r.limitSumma;
        const warn = r.foiz >= 80 && r.foiz < 100;
        const barColor = over || r.foiz >= 100 ? "bg-expense" : warn ? "bg-debt" : "bg-income";
        return (
          <Card key={r.categoryId}>
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <span className="font-medium text-fg">{r.nomi}</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={edits[r.categoryId] ?? ""}
                  onChange={(e) =>
                    setEdits((p) => ({ ...p, [r.categoryId]: e.target.value ? formatSom(parseSomInput(e.target.value)) : "" }))
                  }
                  placeholder="Limit yo'q"
                  className="w-32 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-right tnum"
                />
                <button
                  onClick={() => save(r.categoryId)}
                  disabled={saving === r.categoryId}
                  className="text-sm font-medium text-brand hover:underline disabled:opacity-50 min-h-[36px] px-1"
                >
                  Saqlash
                </button>
              </div>
            </div>
            {r.limitSumma > 0 ? (
              <>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, r.foiz)}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-xs tnum">
                  <span className={over ? "text-expense font-medium" : "text-muted"}>
                    {formatSomLabel(r.sarflangan)} / {formatSomLabel(r.limitSumma)}
                  </span>
                  <span className={over ? "text-expense font-semibold" : warn ? "text-debt dark:text-debt-fg" : "text-muted"}>
                    {r.foiz}%{over ? " · oshib ketdi!" : ""}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted tnum">
                Bu oy sarflangan: {formatSomLabel(r.sarflangan)} · limit belgilanmagan
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
