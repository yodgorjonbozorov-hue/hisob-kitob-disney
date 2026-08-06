"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [parol, setParol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, parol }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        setLoading(false);
        return;
      }
      router.push(data.rol === "SUPERADMIN" ? "/superadmin" : "/app");
      router.refresh();
    } catch {
      setError("Serverga ulanib bo'lmadi");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="login" className="block text-sm font-medium text-fg mb-1">
          Login
        </label>
        <input
          id="login"
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          // Telefon klaviaturasi birinchi harfni kattalashtirmasin va loginni
          // "to'g'rilab" yubormasin — aks holda kirish bekorga rad etiladi.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          autoFocus
          required
        />
      </div>
      <div>
        <label htmlFor="parol" className="block text-sm font-medium text-fg mb-1">
          Parol
        </label>
        <input
          id="parol"
          type="password"
          value={parol}
          onChange={(e) => setParol(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="current-password"
          required
        />
      </div>
      {error && <p className="text-expense text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-income hover:brightness-110 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 transition"
      >
        {loading ? "Kirilmoqda..." : "Kirish"}
      </button>
    </form>
  );
}
