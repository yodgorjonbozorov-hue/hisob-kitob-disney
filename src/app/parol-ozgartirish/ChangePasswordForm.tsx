"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [eski, setEski] = useState("");
  const [yangi, setYangi] = useState("");
  const [yangi2, setYangi2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Oddiy kuch ko'rsatkichi.
  const strength = (() => {
    let s = 0;
    if (yangi.length >= 6) s++;
    if (yangi.length >= 10) s++;
    if (/[0-9]/.test(yangi) && /[a-zA-Z]/.test(yangi)) s++;
    if (/[^a-zA-Z0-9]/.test(yangi)) s++;
    return s; // 0..4
  })();
  const strengthLabel = ["Juda zaif", "Zaif", "O'rtacha", "Yaxshi", "Kuchli"][strength];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (yangi !== yangi2) {
      setError("Yangi parollar mos kelmadi");
      return;
    }
    if (yangi.length < 6) {
      setError("Yangi parol kamida 6 belgi bo'lishi kerak");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/me/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eski, yangi }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Xatolik");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="password"
        value={eski}
        onChange={(e) => setEski(e.target.value)}
        placeholder="Eski parol"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base"
        required
      />
      <input
        type="password"
        value={yangi}
        onChange={(e) => setYangi(e.target.value)}
        placeholder="Yangi parol"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base"
        required
      />
      {yangi && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                strength <= 1 ? "bg-expense" : strength === 2 ? "bg-amber-500" : "bg-income"
              }`}
              style={{ width: `${(strength / 4) * 100}%` }}
            />
          </div>
          <span className="text-2xs text-muted w-16 text-right">{strengthLabel}</span>
        </div>
      )}
      <input
        type="password"
        value={yangi2}
        onChange={(e) => setYangi2(e.target.value)}
        placeholder="Yangi parolni takrorlang"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base"
        required
      />
      {error && <p className="text-expense text-sm">{error}</p>}
      <Button type="submit" loading={loading} size="lg" className="w-full">
        Saqlash
      </Button>
      {!forced && (
        <a href="/" className="block text-center text-sm text-muted hover:text-fg">
          Bekor qilish
        </a>
      )}
    </form>
  );
}
