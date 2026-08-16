"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** O'chirishni bekor qiladi va ilovaga qaytaradi. */
export function OchirishBekorTugma() {
  const router = useRouter();
  const [yuborilmoqda, setYuborilmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function bekorQil() {
    setYuborilmoqda(true);
    setXato(null);
    try {
      const res = await fetch("/api/me/hisob-ochirish", { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Bekor qilinmadi");
      }
      // Server holati o'zgardi — sahifani qaytadan olib kelamiz, guard endi
      // foydalanuvchini /app ga yuboradi.
      router.replace("/app");
      router.refresh();
    } catch (e) {
      setXato(e instanceof Error ? e.message : "Bekor qilinmadi");
      setYuborilmoqda(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void bekorQil()}
        disabled={yuborilmoqda}
        className="w-full py-3 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-60"
      >
        {yuborilmoqda ? "Bekor qilinmoqda…" : "O'chirishni bekor qilish"}
      </button>
      {xato && <p className="text-sm text-expense-fg">{xato}</p>}
    </div>
  );
}
