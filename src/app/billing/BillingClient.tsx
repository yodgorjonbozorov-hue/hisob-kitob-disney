"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProviderInfo } from "@/lib/billing/provider";

/**
 * To'lov usulini tanlash va checkout'ni boshlash.
 *  - Onlayn (Payme/Click): provider sahifasiga yo'naltiriladi, obuna to'lov
 *    tasdiqlangach avtomatik uzayadi (callback → confirmPayment).
 *  - O'tkazma (MANUAL): ko'rsatma ko'rsatiladi, superadmin tasdiqlaydi.
 * Onlayn usullar faqat env sozlangan bo'lsa ro'yxatda bo'ladi.
 */
export function BillingClient({
  planCode,
  providerlar = [],
}: {
  planCode: string;
  providerlar?: ProviderInfo[];
}) {
  const router = useRouter();
  const [korsatma, setKorsatma] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(provider: string) {
    setError(null);
    setLoading(provider);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planCode, provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        return;
      }
      // Onlayn provider — to'lov sahifasiga o'tamiz.
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setKorsatma(data.korsatma ?? "To'lov yaratildi.");
      router.refresh();
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(null);
    }
  }

  if (korsatma) {
    return (
      <div className="rounded-lg bg-surface-2 border border-line p-4">
        <p className="text-sm font-medium text-fg mb-2">To&apos;lov ko&apos;rsatmasi</p>
        <pre className="text-xs text-muted whitespace-pre-wrap font-sans">{korsatma}</pre>
      </div>
    );
  }

  // Onlayn usul ulanmagan bo'lsa — eski ko'rinish: bitta tugma.
  if (providerlar.length <= 1) {
    const yagona = providerlar[0]?.code ?? "MANUAL";
    return (
      <div className="space-y-2">
        <button
          onClick={() => checkout(yagona)}
          disabled={!!loading}
          className="w-full sm:w-auto bg-income hover:brightness-110 disabled:opacity-60 text-white font-medium rounded-lg px-6 py-2.5 transition"
        >
          {loading ? "Yaratilmoqda..." : "To'lov qilish"}
        </button>
        {error && <p className="text-expense text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {providerlar.map((p) => (
          <button
            key={p.code}
            onClick={() => checkout(p.code)}
            disabled={!!loading}
            className={`text-left rounded-lg px-4 py-3 transition disabled:opacity-60 ${
              p.code === "MANUAL"
                ? "bg-surface-2 hover:bg-line text-fg"
                : "bg-income hover:brightness-110 text-white"
            }`}
          >
            <span className="block font-medium">
              {loading === p.code ? "Yaratilmoqda..." : p.nomi}
            </span>
            <span className={`block text-xs ${p.code === "MANUAL" ? "text-muted" : "text-white/80"}`}>
              {p.tavsif}
            </span>
          </button>
        ))}
      </div>
      {error && <p className="text-expense text-sm">{error}</p>}
    </div>
  );
}
