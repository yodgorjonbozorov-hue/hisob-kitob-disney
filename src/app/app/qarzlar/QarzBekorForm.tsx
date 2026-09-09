"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * QARZNI BEKOR QILISH — sabab bilan.
 *
 * O'CHIRISHDAN farqi: bu yerda yozuv o'chirilmaydi ham, tuzatilmaydi ham —
 * qarz "CANCELLED" holatiga o'tadi va pul jamlaridan chiqadi. Shuning uchun
 * u direktordan tashqari, bekor qilish huquqi berilgan xodimga ham ochiq
 * (`bekorQilaOladi`), lekin faqat TO'LOVI YO'Q qarzga.
 *
 * `QarzTafsilot` dan alohida faylga chiqarilgan: u 250 satr chegarasidan
 * oshib ketgan edi.
 */
export function QarzBekorForm({
  debtId,
  onCancel,
  onDone,
}: {
  debtId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [sabab, setSabab] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function yubor() {
    setXato(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/debts/${debtId}/bekor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sabab }),
      });
      if (!res.ok) {
        setXato((await res.json()).error ?? "Xatolik");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <label className="block text-xs text-muted" htmlFor="qarz-bekor-sabab">
        Bekor qilish sababi
      </label>
      <input
        id="qarz-bekor-sabab"
        type="text"
        value={sabab}
        onChange={(e) => setSabab(e.target.value)}
        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        autoFocus
      />
      <p className="text-2xs text-faint">
        Yozuv o&apos;chirilmaydi — kim, qachon va nega bekor qilgani saqlanadi.
      </p>
      {xato && <p className="text-expense text-sm">{xato}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Yopish
        </Button>
        <Button type="button" onClick={yubor} disabled={loading || sabab.trim().length < 3}>
          {loading ? "..." : "Bekor qilish"}
        </Button>
      </div>
    </div>
  );
}
