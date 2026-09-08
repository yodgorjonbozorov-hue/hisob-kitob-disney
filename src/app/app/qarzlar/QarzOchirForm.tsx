"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";

/**
 * QARZNI O'CHIRISH — FAQAT DIREKTOR.
 *
 * O'chirish YUMSHOQ: yozuv bazada qoladi va audit tarixida ko'rinadi
 * (lib/services/qarzTuzatish.ts). To'lovi bor qarzni o'chirib bo'lmaydi —
 * server buni rad etadi va sabab bilan tushuntiradi.
 */
export function QarzOchirForm({
  debtId,
  onCancel,
  onDone,
}: {
  debtId: string;
  onCancel: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [sabab, setSabab] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ochir() {
    if (sabab.trim().length < 3) return setXato("O'chirish sababini yozing");
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/debts/${debtId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sabab: sabab.trim() }),
      });
      const javob = await res.json();
      if (!res.ok) {
        setXato(javob.error ?? "O'chirib bo'lmadi");
        return;
      }
      await onDone();
    } catch {
      setXato("Tarmoq xatosi — qayta urinib ko'ring");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-expense/40 bg-expense-soft/40 p-3 space-y-3">
      <p className="text-sm font-medium text-fg">Qarzni o&apos;chirish</p>
      <div>
        <label className={LABEL_CLASS} htmlFor="qarz-ochir-sabab">
          O&apos;chirish sababi <span className="text-expense">*</span>
        </label>
        <input
          id="qarz-ochir-sabab"
          type="text"
          value={sabab}
          onChange={(e) => setSabab(e.target.value)}
          placeholder="Masalan: takroriy yozuv"
          className={INPUT_CLASS}
        />
        <p className="text-2xs text-faint mt-1">
          Yozuv butunlay yo&apos;qolmaydi — audit tarixida qarzdor nomi, summasi va
          sabab saqlanadi.
        </p>
      </div>
      {xato && <p className="text-sm text-expense">{xato}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          Bekor
        </Button>
        <Button variant="danger" onClick={ochir} loading={loading} disabled={loading}>
          O&apos;chirish
        </Button>
      </div>
    </div>
  );
}
