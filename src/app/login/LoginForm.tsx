"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";

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
        <label htmlFor="login" className={LABEL_CLASS}>
          Login
        </label>
        <input
          id="login"
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className={INPUT_CLASS}
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
        <label htmlFor="parol" className={LABEL_CLASS}>
          Parol
        </label>
        <input
          id="parol"
          type="password"
          value={parol}
          onChange={(e) => setParol(e.target.value)}
          className={INPUT_CLASS}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="current-password"
          required
        />
      </div>
      {error && <p className="text-expense text-sm">{error}</p>}
      {/* Brend rangi — yashil EMAS: yashil bu tizimda "pul kirdi" degani. */}
      <Button type="submit" size="lg" loading={loading} className="w-full">
        {loading ? "Kirilmoqda…" : "Kirish"}
      </Button>
    </form>
  );
}
