"use client";

import { useState, FormEvent } from "react";
import { BIZNES_TURLARI } from "@/lib/validation/demo";
import { ADMIN_TELEGRAM } from "@/lib/billing/constants";

export default function DemoForm() {
  const [ism, setIsm] = useState("");
  const [telefon, setTelefon] = useState("");
  const [biznesTuri, setBiznesTuri] = useState(BIZNES_TURLARI[0]);
  const [izoh, setIzoh] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [yuborildi, setYuborildi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ism, telefon, biznesTuri, izoh }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        setLoading(false);
        return;
      }
      setYuborildi(true);
    } catch {
      setError("Serverga ulanib bo'lmadi");
      setLoading(false);
    }
  }

  if (yuborildi) {
    return (
      <div className="text-center py-4">
        <span className="text-4xl">✅</span>
        <h2 className="text-lg font-semibold text-fg mt-3">Rahmat, so'rovingiz qabul qilindi</h2>
        <p className="text-sm text-muted mt-2">
          Tez orada siz bilan aloqaga chiqamiz. Shoshilinch bo'lsa — Telegram orqali yozing:
        </p>
        <a
          href={ADMIN_TELEGRAM}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 bg-brand text-white font-medium rounded-xl px-6 py-2.5 hover:brightness-110 transition"
        >
          Telegramda yozish
        </a>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-line px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-fg mb-1">Ismingiz</label>
        <input
          type="text"
          value={ism}
          onChange={(e) => setIsm(e.target.value)}
          placeholder="Ism Familiya"
          className={inputCls}
          autoFocus
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-fg mb-1">Telefon raqam</label>
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
        <label className="block text-sm font-medium text-fg mb-1">Biznes turi</label>
        <select value={biznesTuri} onChange={(e) => setBiznesTuri(e.target.value)} className={inputCls} required>
          {BIZNES_TURLARI.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-fg mb-1">
          Izoh <span className="text-faint font-normal">(ixtiyoriy)</span>
        </label>
        <textarea
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          placeholder="Hozir hisobni qanday yuritasiz, nima muammo qilyapti?"
          rows={3}
          maxLength={1000}
          className={inputCls}
        />
      </div>
      {error && <p className="text-expense text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-income hover:brightness-110 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 transition"
      >
        {loading ? "Yuborilmoqda..." : "Demo so'rash"}
      </button>
      <p className="text-2xs text-faint text-center">
        Akkauntni o'zimiz sozlab, login va parol bilan topshiramiz — o'zingiz ro'yxatdan o'tishingiz shart emas.
      </p>
    </form>
  );
}
