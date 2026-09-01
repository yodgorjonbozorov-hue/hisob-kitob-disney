"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

export interface SelectOption {
  value: string;
  label: string;
  /** Yorliq ostidagi kichik izoh (masalan narx yoki telefon). */
  tavsif?: string;
  disabled?: boolean;
}

/**
 * BALANSA SELECT — brauzerning native <select> o'rniga yagona ochiladigan
 * ro'yxat. Native select har OS'da har xil (Windows'da kulrang ro'yxat)
 * ko'rinib, mahsulot qiyofasini buzardi; bu komponent hamma joyda bir xil.
 *
 * Klaviatura: ochish — Enter/Space/Down, yurish — Up/Down/Home/End,
 * tanlash — Enter, yopish — Esc/Tab. `searchable` yoqilsa ro'yxat ustida
 * qidiruv maydoni chiqadi (10+ variantda avtomatik yoqish tavsiya etiladi).
 *
 * Ro'yxat pastga sig'masa yuqoriga ochiladi — modal pastidagi select
 * ekrandan chiqib ketmasin.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Tanlang...",
  searchable = false,
  searchPlaceholder = "Qidirish...",
  disabled = false,
  id,
  className = "",
  buttonClassName = "",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Ro'yxat ustida qidiruv maydoni. */
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  buttonClassName?: string;
  /** Ko'rinadigan label bo'lmagan joylar (filtr panellari) uchun. */
  "aria-label"?: string;
}) {
  const [ochiq, setOchiq] = useState(false);
  const [qidiruv, setQidiruv] = useState("");
  const [faolIndex, setFaolIndex] = useState(-1);
  const [tepaga, setTepaga] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tugmaRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const tanlangan = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const korinadigan = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.tavsif ?? "").toLowerCase().includes(q)
    );
  }, [options, qidiruv]);

  const yop = useCallback(() => {
    setOchiq(false);
    setQidiruv("");
    setFaolIndex(-1);
  }, []);

  function och() {
    if (disabled) return;
    setOchiq(true);
    const i = options.findIndex((o) => o.value === value && !o.disabled);
    setFaolIndex(i >= 0 ? i : options.findIndex((o) => !o.disabled));
  }

  // Pastda joy yetmasa ro'yxatni yuqoriga ochamiz (ochilish faqat clientda
  // bo'ladi, shuning uchun useEffect yetarli — SSR ogohlantirishi yo'q).
  useEffect(() => {
    if (!ochiq || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setTepaga(window.innerHeight - r.bottom < 288 && r.top > 288);
  }, [ochiq]);

  // Ochilganda qidiruvga fokus; faol qator ko'rinadigan joyga suriladi.
  useEffect(() => {
    if (!ochiq) return;
    if (searchable) searchRef.current?.focus();
    const el = listRef.current?.querySelector<HTMLElement>('[data-faol="ha"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [ochiq, faolIndex, searchable]);

  // Tashqariga bosilganda yopiladi.
  useEffect(() => {
    if (!ochiq) return;
    function tashqari(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) yop();
    }
    document.addEventListener("mousedown", tashqari);
    return () => document.removeEventListener("mousedown", tashqari);
  }, [ochiq, yop]);

  function tanla(o: SelectOption) {
    if (o.disabled) return;
    onChange(o.value);
    yop();
    tugmaRef.current?.focus();
  }

  function klaviatura(e: React.KeyboardEvent) {
    if (!ochiq) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        och();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      yop();
      tugmaRef.current?.focus();
      return;
    }
    if (e.key === "Tab") {
      yop();
      return;
    }
    const yurish = (boshlash: number, qadam: number) => {
      for (
        let i = boshlash;
        i >= 0 && i < korinadigan.length;
        i += qadam
      ) {
        if (!korinadigan[i].disabled) return i;
      }
      return faolIndex;
    };
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFaolIndex((i) => yurish(Math.min(i + 1, korinadigan.length - 1), 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFaolIndex((i) => yurish(Math.max(i - 1, 0), -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setFaolIndex(yurish(0, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      setFaolIndex(yurish(korinadigan.length - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = korinadigan[faolIndex];
      if (o) tanla(o);
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`} onKeyDown={klaviatura}>
      <button
        ref={tugmaRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (ochiq ? yop() : och())}
        role="combobox"
        aria-expanded={ochiq}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-label={ariaLabel}
        className={
          "w-full flex items-center justify-between gap-2 rounded-lg border border-line bg-surface " +
          "px-3 py-2.5 text-sm min-h-[44px] text-left transition " +
          "hover:border-line-strong focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand " +
          "disabled:opacity-60 disabled:cursor-not-allowed " +
          buttonClassName
        }
      >
        <span className={`truncate ${tanlangan ? "text-fg" : "text-faint"}`}>
          {tanlangan ? tanlangan.label : placeholder}
        </span>
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
        <div
          className={`absolute z-50 w-full min-w-[220px] rounded-lg border border-line bg-surface shadow-raised overflow-hidden ${
            tepaga ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {searchable && (
            <div className="p-2 border-b border-line">
              <input
                ref={searchRef}
                type="text"
                value={qidiruv}
                onChange={(e) => {
                  setQidiruv(e.target.value);
                  setFaolIndex(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-brand"
                autoComplete="off"
              />
            </div>
          )}
          <div ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {korinadigan.length === 0 && (
              <p className="px-3 py-2.5 text-xs text-faint">Hech narsa topilmadi</p>
            )}
            {korinadigan.map((o, i) => {
              const joriy = o.value === value;
              const faol = i === faolIndex;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={joriy}
                  disabled={o.disabled}
                  data-faol={faol ? "ha" : undefined}
                  onMouseEnter={() => setFaolIndex(i)}
                  onClick={() => tanla(o)}
                  className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-sm transition-colors ${
                    o.disabled
                      ? "opacity-45 cursor-not-allowed"
                      : faol
                        ? "bg-brand-wash text-fg"
                        : "text-fg"
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate ${joriy ? "font-medium" : ""}`}>{o.label}</span>
                    {o.tavsif && <span className="block text-2xs text-muted truncate">{o.tavsif}</span>}
                  </span>
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
