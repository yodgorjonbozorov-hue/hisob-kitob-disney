"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();
  const [kompaniya, setKompaniya] = useState("");
  const [ism, setIsm] = useState("");
  const [telefon, setTelefon] = useState("");
  const [parol, setParol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (parol.length < 8) {
      setError("Parol kamida 8 belgi bo'lishi kerak");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kompaniya, ism, telefon, parol }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        setLoading(false);
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      setError("Serverga ulanib bo'lmadi");
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-fg mb-1">Kompaniya nomi</label>
        <input
          type="text"
          value={kompaniya}
          onChange={(e) => setKompaniya(e.target.value)}
          placeholder="Masalan: Baraka Market"
          className={inputCls}
          autoFocus
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-fg mb-1">Ismingiz</label>
        <input
          type="text"
          value={ism}
          onChange={(e) => setIsm(e.target.value)}
          placeholder="Ism Familiya"
          className={inputCls}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-fg mb-1">Telefon raqam (login)</label>
        <input
          type="tel"
          value={telefon}
          onChange={(e) => setTelefon(e.target.value)}
          placeholder="+998 90 123 45 67"
          className={inputCls}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-fg mb-1">Parol</label>
        <input
          type="password"
          value={parol}
          onChange={(e) => setParol(e.target.value)}
          placeholder="Kamida 8 belgi"
          minLength={8}
          className={inputCls}
          required
        />
      </div>
      {error && <p className="text-expense text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-income hover:brightness-110 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 transition"
      >
        {loading ? "Yaratilmoqda..." : "Bepul boshlash (14 kun)"}
      </button>
      <p className="text-2xs text-faint text-center">
        Ro'yxatdan o'tish bilan siz ma'lumotlaringiz faqat sizning kompaniyangizga ko'rinishini kafolatlaydigan
        tizimda hisob ochasiz.
      </p>
    </form>
  );
}
