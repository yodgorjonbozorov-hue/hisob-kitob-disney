"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "To'lov qilish" tugmasi — MANUAL checkout boshlaydi va ko'rsatmani ko'rsatadi. */
export function BillingClient({ planCode }: { planCode: string }) {
  const router = useRouter();
  const [korsatma, setKorsatma] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setKorsatma(data.korsatma ?? "To'lov yaratildi.");
      router.refresh();
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  if (korsatma) {
    return (
      <div className="rounded-lg bg-surface-2 border border-line p-4">
        <p className="text-sm font-medium text-fg mb-2">To'lov ko'rsatmasi</p>
        <pre className="text-xs text-muted whitespace-pre-wrap font-sans">{korsatma}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={checkout}
        disabled={loading}
        className="w-full sm:w-auto bg-income hover:brightness-110 disabled:opacity-60 text-white font-medium rounded-lg px-6 py-2.5 transition"
      >
        {loading ? "Yaratilmoqda..." : "To'lov qilish"}
      </button>
      {error && <p className="text-expense text-sm">{error}</p>}
    </div>
  );
}
