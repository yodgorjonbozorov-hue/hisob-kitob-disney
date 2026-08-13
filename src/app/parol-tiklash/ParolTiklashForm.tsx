"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const INPUT_CLASS =
  "w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * Ikki qadamli forma: 1) login kiritib kod so'rash; 2) Telegramdagi kod +
 * yangi parol. Server javobi login mavjudligini oshkor qilmaydi — matnlar
 * shunga mos yozilgan.
 */
export function ParolTiklashForm() {
  const router = useRouter();
  const [qadam, setQadam] = useState<1 | 2>(1);
  const [login, setLogin] = useState("");
  const [kod, setKod] = useState("");
  const [parol, setParol] = useState("");
  const [xabar, setXabar] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function kodSora(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/auth/parol-tiklash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setXabar(data.message ?? null);
      setQadam(2);
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  async function tasdiqla(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/auth/parol-tiklash/tasdiq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, kod, parol }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      router.push("/login");
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  if (qadam === 1) {
    return (
      <form onSubmit={kodSora} className="space-y-4">
        <p className="text-sm text-muted">
          Loginingizni kiriting — hisobingizga ulangan Telegram botga 6 raqamli tiklash kodi
          yuboriladi.
        </p>
        <div>
          <label htmlFor="pt-login" className="block text-sm font-medium text-fg mb-1">
            Login
          </label>
          <input
            id="pt-login"
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className={INPUT_CLASS}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            autoFocus
            required
          />
        </div>
        {xato && <p className="text-expense text-sm">{xato}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-income hover:brightness-110 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 transition"
        >
          {loading ? "Yuborilmoqda..." : "Kod yuborish"}
        </button>
        <p className="text-2xs text-faint">
          Telegram ulanmagan bo&apos;lsa kod kelmaydi — parolni direktoringiz (yoki
          administrator) yangilab beradi.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={tasdiqla} className="space-y-4">
      {xabar && <p className="text-sm text-muted">{xabar}</p>}
      <div>
        <label htmlFor="pt-kod" className="block text-sm font-medium text-fg mb-1">
          Telegramdagi 6 raqamli kod
        </label>
        <input
          id="pt-kod"
          type="text"
          value={kod}
          onChange={(e) => setKod(e.target.value)}
          className={INPUT_CLASS + " tnum"}
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          required
        />
      </div>
      <div>
        <label htmlFor="pt-parol" className="block text-sm font-medium text-fg mb-1">
          Yangi parol (kamida 8 belgi)
        </label>
        <input
          id="pt-parol"
          type="password"
          value={parol}
          onChange={(e) => setParol(e.target.value)}
          className={INPUT_CLASS}
          minLength={8}
          autoComplete="new-password"
          required
        />
      </div>
      {xato && <p className="text-expense text-sm">{xato}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-income hover:brightness-110 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 transition"
      >
        {loading ? "Saqlanmoqda..." : "Parolni yangilash"}
      </button>
      <button
        type="button"
        onClick={() => setQadam(1)}
        className="w-full text-sm text-muted hover:text-fg transition"
      >
        ← Boshqa login kiritish
      </button>
    </form>
  );
}
