"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface BusinessOption {
  id: string;
  nomi: string;
}

/**
 * BIZNES ALMASHTIRGICH — sidebar yuqorisidagi asosiy boshqaruv.
 *
 * Ilgari native <select> edi — ochilganda operatsion tizimning kulrang
 * ro'yxati chiqib, mahsulot qiyofasini buzardi. Endi Balansa uslubidagi
 * ochiladigan panel: qidiruv (5+ biznes bo'lsa), klaviatura bilan yurish,
 * faol biznes belgisi. Tanlanganda avvalgidek cookie o'rnatiladi va sahifa
 * yangilanadi — almashish mantig'i O'ZGARMAGAN (/api/me/active-business).
 */
export function BusinessSwitcher({
  businesses,
  activeId,
}: {
  businesses: BusinessOption[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [ochiq, setOchiq] = useState(false);
  const [qidiruv, setQidiruv] = useState("");
  const [faolIndex, setFaolIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tugmaRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const faol = businesses.find((b) => b.id === activeId) ?? businesses[0] ?? null;
  const qidiruvli = businesses.length > 5;

  const korinadigan = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((b) => b.nomi.toLowerCase().includes(q));
  }, [businesses, qidiruv]);

  const yop = useCallback(() => {
    setOchiq(false);
    setQidiruv("");
  }, []);

  function och() {
    setOchiq(true);
    const i = businesses.findIndex((b) => b.id === activeId);
    setFaolIndex(i >= 0 ? i : 0);
  }

  useEffect(() => {
    if (!ochiq) return;
    if (qidiruvli) searchRef.current?.focus();
    listRef.current
      ?.querySelector<HTMLElement>('[data-faol="ha"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [ochiq, faolIndex, qidiruvli]);

  useEffect(() => {
    if (!ochiq) return;
    function tashqari(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) yop();
    }
    document.addEventListener("mousedown", tashqari);
    return () => document.removeEventListener("mousedown", tashqari);
  }, [ochiq, yop]);

  async function tanla(businessId: string) {
    yop();
    if (businessId === activeId) return;
    setLoading(true);
    try {
      await fetch("/api/me/active-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function klaviatura(e: React.KeyboardEvent) {
    if (!ochiq) return;
    if (e.key === "Escape") {
      e.preventDefault();
      yop();
      tugmaRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFaolIndex((i) => Math.min(i + 1, korinadigan.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFaolIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const b = korinadigan[faolIndex];
      if (b) void tanla(b.id);
    } else if (e.key === "Tab") {
      yop();
    }
  }

  // Bitta biznes — tanlash shart emas, shunchaki nomi ko'rsatiladi.
  if (businesses.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm font-medium border border-line">
        <span className="w-2 h-2 rounded-full bg-brand shrink-0" />
        <span className="truncate">{faol?.nomi ?? "—"}</span>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative" onKeyDown={klaviatura}>
      <button
        ref={tugmaRef}
        type="button"
        disabled={loading}
        onClick={() => (ochiq ? yop() : och())}
        aria-expanded={ochiq}
        aria-haspopup="listbox"
        aria-label="Biznesni almashtirish"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm font-medium border border-line transition hover:border-line-strong focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand disabled:opacity-60"
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${loading ? "bg-warning animate-pulse" : "bg-brand"}`}
        />
        <span className="truncate flex-1 text-left">{faol?.nomi ?? "Biznes tanlang"}</span>
        <svg
          className={`w-4 h-4 shrink-0 text-faint transition-transform ${ochiq ? "rotate-180" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {ochiq && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-line bg-surface shadow-raised overflow-hidden">
          {qidiruvli && (
            <div className="p-2 border-b border-line">
              <input
                ref={searchRef}
                type="text"
                value={qidiruv}
                onChange={(e) => {
                  setQidiruv(e.target.value);
                  setFaolIndex(0);
                }}
                placeholder="Biznesni qidiring..."
                aria-label="Biznesni qidirish"
                className="w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-brand"
                autoComplete="off"
              />
            </div>
          )}
          <div ref={listRef} role="listbox" aria-label="Bizneslar" className="max-h-72 overflow-y-auto py-1">
            {korinadigan.length === 0 && (
              <p className="px-3 py-2.5 text-xs text-faint">Biznes topilmadi</p>
            )}
            {korinadigan.map((b, i) => {
              const joriy = b.id === activeId;
              const belgilangan = i === faolIndex;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={joriy}
                  data-faol={belgilangan ? "ha" : undefined}
                  onMouseEnter={() => setFaolIndex(i)}
                  onClick={() => void tanla(b.id)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-2 text-sm transition-colors ${
                    belgilangan ? "bg-brand-wash" : ""
                  } ${joriy ? "text-fg font-medium" : "text-fg"}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${joriy ? "bg-brand" : "bg-line"}`}
                    aria-hidden="true"
                  />
                  <span className="truncate flex-1">{b.nomi}</span>
                  {joriy && (
                    <svg className="w-4 h-4 shrink-0 text-brand" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
