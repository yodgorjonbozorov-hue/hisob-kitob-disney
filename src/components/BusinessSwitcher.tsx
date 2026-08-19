"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
interface BusinessOption {
  id: string;
  nomi: string;
}

/**
 * Biznes tanlash dropdown'i; tanlanganda cookie o'rnatiladi va sahifa yangilanadi.
 *
 * Ro'yxat — foydalanuvchiga OCHIQ bizneslar (lib/business.ts). Bitta biznes
 * bo'lsa tanlash o'rniga shunchaki nomi ko'rsatiladi. KASSIR ham bir nechta
 * biznesga biriktirilgan bo'lsa almasha oladi: bir jamoa ikki biznesni
 * yuritganda (hisob-kitob alohida) shu kerak bo'ladi.
 */
export function BusinessSwitcher({
  businesses,
  activeId,
}: {
  businesses: BusinessOption[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (businesses.length <= 1) {
    const nomi = businesses.find((b) => b.id === activeId)?.nomi ?? businesses[0]?.nomi ?? "—";
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm font-medium border border-line">
        <span className="w-2 h-2 rounded-full bg-brand shrink-0" />
        <span className="truncate">{nomi}</span>
      </div>
    );
  }

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const businessId = e.target.value;
    setLoading(true);
    try {
      await fetch("/api/me/active-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={activeId ?? ""}
      onChange={handleChange}
      disabled={loading}
      className="w-full px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm font-medium border border-line focus:outline-none focus:border-brand"
    >
      {businesses.map((b) => (
        <option key={b.id} value={b.id}>
          {b.nomi}
        </option>
      ))}
    </select>
  );
}
