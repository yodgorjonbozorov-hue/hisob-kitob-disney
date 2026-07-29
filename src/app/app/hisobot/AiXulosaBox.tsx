"use client";

import { useState } from "react";

/** Oylik hisobotga 1-klik AI xulosa (AI moduli yoqiq bo'lganda ko'rinadi). */
export function AiXulosaBox({ month }: { month: string }) {
  const [xulosa, setXulosa] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [kutilmoqda, setKutilmoqda] = useState(false);

  async function olish() {
    setKutilmoqda(true);
    setXato(null);
    try {
      const res = await fetch(`/api/ai/hisobot-xulosa?month=${month}`);
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setXulosa(data.xulosa);
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setKutilmoqda(false);
    }
  }

  return (
    <div className="bg-surface rounded-2xl border border-line p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-fg">✨ AI xulosa</h3>
        {!xulosa && (
          <button
            onClick={olish}
            disabled={kutilmoqda}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-60"
          >
            {kutilmoqda ? "Tahlil qilinmoqda..." : "Xulosa olish"}
          </button>
        )}
      </div>
      {xato && <p className="text-expense text-sm mt-2">{xato}</p>}
      {xulosa && <p className="text-sm text-fg mt-3 whitespace-pre-wrap">{xulosa}</p>}
    </div>
  );
}
