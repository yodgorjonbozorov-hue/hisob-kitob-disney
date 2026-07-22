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

  if (rol === "kassir" || businesses.length <= 1) {
    const nomi = businesses.find((b) => b.id === activeId)?.nomi ?? businesses[0]?.nomi ?? "—";
    return (
      <div className="px-3 py-2 rounded-lg bg-slate-800 text-slate-100 text-sm font-medium">{nomi}</div>
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
      className="px-3 py-2 rounded-lg bg-slate-800 text-slate-100 text-sm font-medium border border-slate-700 focus:outline-none"
    >
      {businesses.map((b) => (
        <option key={b.id} value={b.id}>
          {b.nomi}
        </option>
      ))}
    </select>
  );
}
