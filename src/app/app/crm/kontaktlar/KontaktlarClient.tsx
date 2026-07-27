"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface KontaktDTO {
  id: string;
  ism: string;
  tel: string | null;
  telegram: string | null;
  izoh: string | null;
  bitimlar: number;
}

export function KontaktlarClient({ initial }: { initial: KontaktDTO[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [ochiq, setOchiq] = useState(false);

  const ql = q.trim().toLowerCase();
  const royxat = ql
    ? initial.filter((c) => c.ism.toLowerCase().includes(ql) || (c.tel ?? "").includes(ql))
    : initial;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Qidirish (ism yoki telefon)..."
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          onClick={() => setOchiq(true)}
          className="bg-income text-white font-medium rounded-lg px-4 py-2 text-sm hover:brightness-110 transition shrink-0"
        >
          + Kontakt
        </button>
      </div>

      <div className="bg-surface rounded-2xl border border-line divide-y divide-line">
        {royxat.length === 0 ? (
          <p className="text-sm text-faint p-6 text-center">Kontakt topilmadi. Birinchisini qo'shing!</p>
        ) : (
          royxat.map((c) => (
            <div key={c.id} className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-wash text-brand flex items-center justify-center font-semibold text-sm shrink-0">
                {c.ism.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg truncate">{c.ism}</p>
                <p className="text-xs text-muted truncate">
                  {[c.tel, c.telegram, c.izoh].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className="text-2xs text-faint shrink-0">{c.bitimlar} bitim</span>
              {c.tel && (
                <a href={`tel:${c.tel}`} className="text-brand text-sm font-medium shrink-0">
                  Qo'ng'iroq
                </a>
              )}
            </div>
          ))
        )}
      </div>

      {ochiq && <YangiKontaktModal onClose={() => { setOchiq(false); router.refresh(); }} />}
    </div>
  );
}

function YangiKontaktModal({ onClose }: { onClose: () => void }) {
  const [ism, setIsm] = useState("");
  const [tel, setTel] = useState("");
  const [izoh, setIzoh] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saqlash(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    const res = await fetch("/api/crm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ism, tel: tel || null, izoh: izoh || null }),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Xatolik yuz berdi");
      return;
    }
    onClose();
  }

  const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <form
        onSubmit={saqlash}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-line p-5 space-y-3"
      >
        <h2 className="font-semibold text-fg text-lg">Yangi kontakt</h2>
        <input autoFocus value={ism} onChange={(e) => setIsm(e.target.value)} placeholder="Ism" className={input} required />
        <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="Telefon" className={input} />
        <input value={izoh} onChange={(e) => setIzoh(e.target.value)} placeholder="Izoh (ixtiyoriy)" className={input} />
        {xato && <p className="text-expense text-sm">{xato}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-line text-sm text-muted">
            Bekor
          </button>
          <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg bg-income text-white text-sm font-medium disabled:opacity-60">
            {loading ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </form>
    </div>
  );
}
