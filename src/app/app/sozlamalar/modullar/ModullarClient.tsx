"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ModulKarta {
  code: string;
  nomi: string;
  tavsif: string;
  core: boolean;
  tarifdaBor: boolean;
  yoqilgan: boolean;
}

export function ModullarClient({ kartalar }: { kartalar: ModulKarta[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  async function toggle(m: ModulKarta) {
    setBusy(m.code);
    setXato(null);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: m.code, isActive: !m.yoqilgan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {xato && (
        <div className="rounded-xl border border-expense/40 bg-expense-soft text-expense-fg px-4 py-3 text-sm">
          {xato}
        </div>
      )}
      {kartalar.map((m) => (
        <div key={m.code} className="bg-surface rounded-2xl border border-line p-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-fg">{m.nomi}</h2>
              {m.core && (
                <span className="text-2xs px-2 py-0.5 rounded-full bg-surface-2 text-muted">asosiy</span>
              )}
              {!m.tarifdaBor && (
                <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-wash text-brand">yuqori tarifda</span>
              )}
            </div>
            <p className="text-sm text-muted mt-1">{m.tavsif}</p>
          </div>
          {m.core ? (
            <span className="text-xs text-faint shrink-0 mt-1">doim yoqiq</span>
          ) : (
            <button
              onClick={() => toggle(m)}
              disabled={busy === m.code || (!m.yoqilgan && !m.tarifdaBor)}
              aria-label={`${m.nomi} modulini ${m.yoqilgan ? "o'chirish" : "yoqish"}`}
              className={`relative shrink-0 w-11 h-6 rounded-full transition disabled:opacity-40 ${
                m.yoqilgan ? "bg-income" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  m.yoqilgan ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
