"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Rol } from "@/lib/auth/session";

interface BusinessOption {
  id: string;
  nomi: string;
}

/**
 * Admin uchun biznes tanlash dropdown'i; tanlanganda cookie o'rnatiladi va sahifa yangilanadi.
 * Kassir uchun faqat biznes nomi ko'rsatiladi (o'zgartira olmaydi).
 */
export function BusinessSwitcher({
  businesses,
  activeId,
  rol,
}: {
  businesses: BusinessOption[];
  activeId: string | null;
  rol: Rol;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (rol === "CASHIER" || businesses.length <= 1) {
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
