"use client";

import { useState, FormEvent } from "react";
import { PLANLAR } from "@/lib/billing/plans";
import { SETUP_FEE_USD, TRIAL_KUNLARI } from "@/lib/billing/constants";

interface Natija {
  kompaniya: string;
  login: string;
  parol: string;
}

/**
 * Qo'lda kompaniya ochish modali. Vaqtinchalik parol serverdan BIR MARTA
 * keladi va faqat shu ekranda ko'rsatiladi — hech qayerda saqlanmaydi.
 */
export function YangiKompaniyaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [kompaniyaNomi, setKompaniyaNomi] = useState("");
  const [direktorIsmi, setDirektorIsmi] = useState("");
  const [telefon, setTelefon] = useState("");
  const [plan, setPlan] = useState(PLANLAR[0].code);
  const [trialKunlari, setTrialKunlari] = useState(String(TRIAL_KUNLARI));
  const [setupFeeOlindi, setSetupFeeOlindi] = useState(false);
  const [setupFeeAmountUsd, setSetupFeeAmountUsd] = useState(String(SETUP_FEE_USD));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [natija, setNatija] = useState<Natija | null>(null);
  const [nusxaOlindi, setNusxaOlindi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kompaniyaNomi,
          direktorIsmi,
          telefon,
          plan,
          trialKunlari: Number(trialKunlari),
          setupFeeOlindi,
          setupFeeAmountUsd: Number(setupFeeAmountUsd),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        setLoading(false);
        return;
      }
      setNatija({ kompaniya: data.tenant.name, login: data.login, parol: data.vaqtinchalikParol });
      onCreated();
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  async function nusxaOl() {
    if (!natija) return;
    const matn = `Kompaniya: ${natija.kompaniya}\nLogin: ${natija.login}\nParol: ${natija.parol}`;
    try {
      await navigator.clipboard.writeText(matn);
      setNusxaOlindi(true);
    } catch {
      setError("Nusxa olinmadi — matnni qo'lda belgilang");
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
  const labelCls = "block text-sm font-medium text-fg mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl border border-line shadow-card w-full max-w-md p-6 my-8">
        {natija ? (
          <div>
            <h2 className="text-lg font-semibold text-fg">Kompaniya yaratildi</h2>
            <p className="text-sm text-muted mt-1">
              Parol faqat HOZIR ko&apos;rinadi — sahifani yopsangiz qayta ko&apos;rsatib bo&apos;lmaydi
              (bazada faqat hash saqlanadi). Mijozga yetkazing.
            </p>
            <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4 text-sm space-y-1.5">
              <p>
                <span className="text-muted">Kompaniya:</span>{" "}
                <span className="font-medium text-fg">{natija.kompaniya}</span>
              </p>
              <p>
                <span className="text-muted">Login:</span>{" "}
                <span className="font-mono font-medium text-fg">{natija.login}</span>
              </p>
              <p>
                <span className="text-muted">Vaqtinchalik parol:</span>{" "}
                <span className="font-mono font-medium text-fg text-base">{natija.parol}</span>
              </p>
            </div>
            <p className="text-xs text-faint mt-3">
              Birinchi kirishda tizim parolni almashtirishni majburlaydi.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={nusxaOl}
                className="flex-1 bg-brand text-white font-medium rounded-lg py-2.5 text-sm hover:brightness-110 transition"
              >
                {nusxaOlindi ? "✓ Nusxa olindi" : "Nusxa olish"}
              </button>
              <button
                onClick={onClose}
                className="flex-1 border border-line rounded-lg py-2.5 text-sm font-medium hover:bg-surface-2 transition"
              >
                Yopish
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <h2 className="text-lg font-semibold text-fg">Yangi kompaniya yaratish</h2>
            <div>
              <label className={labelCls}>Kompaniya nomi</label>
              <input
                type="text"
                value={kompaniyaNomi}
                onChange={(e) => setKompaniyaNomi(e.target.value)}
                className={inputCls}
                placeholder="Masalan: Baraka Market"
                autoFocus
                required
              />
            </div>
            <div>
              <label className={labelCls}>Direktor ismi</label>
              <input
                type="text"
                value={direktorIsmi}
                onChange={(e) => setDirektorIsmi(e.target.value)}
                className={inputCls}
                placeholder="Ism Familiya"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Telefon raqam (login bo&apos;ladi)</label>
              <input
                type="tel"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                className={inputCls}
                placeholder="+998 90 123 45 67"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tarif</label>
                <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls}>
                  {PLANLAR.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.nomi} — {p.oylikNarx.toLocaleString("ru-RU")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sinov (kun)</label>
                <input
                  type="number"
                  min={0}
                  max={366}
                  value={trialKunlari}
                  onChange={(e) => setTrialKunlari(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            </div>
            <div className="rounded-xl border border-line p-3.5 space-y-2.5">
              <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
                <input
                  type="checkbox"
                  checked={setupFeeOlindi}
                  onChange={(e) => setSetupFeeOlindi(e.target.checked)}
                  className="rounded border-line"
                />
                O&apos;rnatish to&apos;lovi olindi
              </label>
              {setupFeeOlindi && (
                <div>
                  <label className={labelCls}>Summa (USD)</label>
                  <input
                    type="number"
                    min={0}
                    value={setupFeeAmountUsd}
                    onChange={(e) => setSetupFeeAmountUsd(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}
            </div>
            {error && <p className="text-expense text-sm">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-income text-white font-medium rounded-lg py-2.5 text-sm hover:brightness-110 disabled:opacity-60 transition"
              >
                {loading ? "Yaratilmoqda..." : "Yaratish"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 border border-line rounded-lg py-2.5 text-sm font-medium hover:bg-surface-2 transition"
              >
                Bekor qilish
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
