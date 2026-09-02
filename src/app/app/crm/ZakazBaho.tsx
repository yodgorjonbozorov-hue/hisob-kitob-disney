"use client";

import { useState } from "react";
import type { ZakazBahoDTO } from "@/lib/services/zakazBaho";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/** 1..10 baho tugmalari — barmoq uchun 32px, tor ekranda o'raladi. */
function BahoChiplar({
  qiymat,
  onChange,
  label,
}: {
  qiymat: number | null;
  onChange: (v: number | null) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={qiymat === n}
          onClick={() => onChange(qiymat === n ? null : n)}
          className={`w-8 h-8 rounded-full text-xs font-medium border transition ${
            qiymat === n ? "bg-brand text-white border-brand" : "border-line text-muted hover:border-brand/50"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/**
 * SIFAT NAZORATI BLOKI (24/25-talab) — faqat YAKUNLANGAN zakazda.
 * Servis bahosi (zakaz darajasi) + har jamoa a'zosiga baho (biriktiruv
 * darajasi) + mijoz e'tirozi + "nimani yaxshilash kerak". Hammasi ixtiyoriy.
 */
export function ZakazBahoBlok({
  dealId,
  baho,
  yozaOladi,
  onSaqlandi,
}: {
  dealId: string;
  /** null — hali yuklanmagan. */
  baho: ZakazBahoDTO | null;
  /** `crm.baho` huquqi. */
  yozaOladi: boolean;
  onSaqlandi: () => void;
}) {
  const [tahrir, setTahrir] = useState(false);
  const [servis, setServis] = useState<number | null>(null);
  const [etiroz, setEtiroz] = useState("");
  const [yaxshilash, setYaxshilash] = useState("");
  const [xodimBaho, setXodimBaho] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  function boshla() {
    if (!baho) return;
    setServis(baho.servisBahosi);
    setEtiroz(baho.etiroz ?? "");
    setYaxshilash(baho.yaxshilash ?? "");
    setXodimBaho(Object.fromEntries(baho.xodimlar.map((x) => [x.id, x.baho])));
    setTahrir(true);
  }

  async function saqlash() {
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${dealId}/baho`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        servisBahosi: servis,
        etiroz: etiroz || null,
        yaxshilash: yaxshilash || null,
        xodimBaholari: Object.entries(xodimBaho).map(([id, b]) => ({ id, baho: b })),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Saqlanmadi");
      return;
    }
    setTahrir(false);
    onSaqlandi();
  }

  const bahoBor =
    baho && (baho.servisBahosi !== null || baho.etiroz || baho.yaxshilash || baho.xodimlar.some((x) => x.baho !== null));

  return (
    <div className="rounded-xl border border-line bg-surface-2/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-2xs uppercase tracking-wide text-faint">Sifat nazorati</p>
        {yozaOladi && baho && !tahrir && (
          <button onClick={boshla} className="text-brand text-xs font-medium">
            {bahoBor ? "O'zgartirish" : "Baholash"}
          </button>
        )}
      </div>

      {tahrir && baho ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted">Servis bahosi (1–10)</p>
            <BahoChiplar qiymat={servis} onChange={setServis} label="Servis bahosi" />
          </div>
          {baho.xodimlar.map((x) => (
            <div key={x.id} className="space-y-1">
              <p className="text-xs text-muted">
                {x.kategoriyaNomi} · <span className="text-fg">{x.ism}</span>
              </p>
              <BahoChiplar
                qiymat={xodimBaho[x.id] ?? null}
                onChange={(v) => setXodimBaho({ ...xodimBaho, [x.id]: v })}
                label={`${x.ism} bahosi`}
              />
            </div>
          ))}
          <label className="block space-y-1">
            <span className="text-xs text-muted">Mijoz e&apos;tirozi</span>
            <textarea value={etiroz} onChange={(e) => setEtiroz(e.target.value)} rows={2} className={INPUT} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted">Nimani yaxshilash kerak?</span>
            <textarea value={yaxshilash} onChange={(e) => setYaxshilash(e.target.value)} rows={2} className={INPUT} />
          </label>
          {xato && <p className="text-expense text-sm">{xato}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setTahrir(false)} className="px-3 py-1.5 rounded-lg border border-line text-xs text-muted">
              Bekor
            </button>
            <button
              onClick={saqlash}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-medium disabled:opacity-60"
            >
              {loading ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      ) : baho === null ? (
        <p className="text-sm text-faint">Yuklanmoqda...</p>
      ) : !bahoBor ? (
        <p className="text-sm text-faint">Hali baholanmagan.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {baho.servisBahosi !== null && (
            <li className="flex justify-between gap-3">
              <span className="text-muted">Servis</span>
              <span className="font-medium text-fg tnum">{baho.servisBahosi}/10</span>
            </li>
          )}
          {baho.xodimlar
            .filter((x) => x.baho !== null)
            .map((x) => (
              <li key={x.id} className="flex justify-between gap-3">
                <span className="text-muted">
                  {x.kategoriyaNomi} · {x.ism}
                </span>
                <span className="font-medium text-fg tnum">{x.baho}/10</span>
              </li>
            ))}
          {baho.etiroz && (
            <li className="text-xs text-expense whitespace-pre-line">E&apos;tiroz: {baho.etiroz}</li>
          )}
          {baho.yaxshilash && (
            <li className="text-xs text-muted whitespace-pre-line">Yaxshilash: {baho.yaxshilash}</li>
          )}
        </ul>
      )}
    </div>
  );
}
