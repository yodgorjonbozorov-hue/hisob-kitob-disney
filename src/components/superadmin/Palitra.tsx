"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { turLabel, type QidiruvNatija } from "@/lib/superadmin/turlar";
import type { SaNavBolim } from "@/lib/superadmin/navigatsiya";

/**
 * GLOBAL QIDIRUV / COMMAND PALETTE (talab 33).
 *
 * CMD/CTRL + K bilan ochiladi. Ikki manba:
 *  · BO'LIMLAR — darhol, mahalliy (server so'rovisiz);
 *  · MA'LUMOT — kompaniya/foydalanuvchi/to'lov/obuna/audit, serverdan.
 *
 * So'rov 250 ms kechikish bilan yuboriladi va oldingi so'rov BEKOR QILINADI
 * (AbortController) — tez yozganda javoblar bir-birini quvib o'tmaydi.
 */
export function Palitra({ bolimlar }: { bolimlar: SaNavBolim[] }) {
  const router = useRouter();
  const [ochiq, setOchiq] = useState(false);
  const [matn, setMatn] = useState("");
  const [natijalar, setNatijalar] = useState<QidiruvNatija[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [tanlangan, setTanlangan] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function klavish(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOchiq((v) => !v);
      }
      if (e.key === "Escape") setOchiq(false);
    }
    window.addEventListener("keydown", klavish);
    return () => window.removeEventListener("keydown", klavish);
  }, []);

  useEffect(() => {
    if (ochiq) input.current?.focus();
    else {
      setMatn("");
      setNatijalar([]);
      setTanlangan(0);
    }
  }, [ochiq]);

  useEffect(() => {
    const q = matn.trim();
    if (q.length < 2) {
      setNatijalar([]);
      return;
    }
    const ctrl = new AbortController();
    setYuklanmoqda(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/superadmin/qidiruv?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { natijalar: QidiruvNatija[] };
          setNatijalar(data.natijalar);
        }
      } catch {
        // Bekor qilingan so'rov — e'tiborsiz qoldiriladi.
      } finally {
        setYuklanmoqda(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [matn]);

  const past = matn.trim().toLowerCase();
  const mosBolimlar = past
    ? bolimlar.filter((b) => b.label.toLowerCase().includes(past) || b.izoh.toLowerCase().includes(past))
    : bolimlar;

  type Qator = { href: string; sarlavha: string; izoh: string; turi: string };
  const qatorlar: Qator[] = [
    ...mosBolimlar.map((b) => ({ href: b.href, sarlavha: b.label, izoh: b.izoh, turi: "Bo'lim" })),
    ...natijalar.map((n) => ({
      href: n.href,
      sarlavha: n.sarlavha,
      izoh: n.izoh,
      turi: turLabel(n.turi),
    })),
  ];

  const otish = useCallback(
    (href: string) => {
      setOchiq(false);
      router.push(href);
    },
    [router]
  );

  function klavishNav(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setTanlangan((i) => Math.min(i + 1, qatorlar.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setTanlangan((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && qatorlar[tanlangan]) {
      e.preventDefault();
      otish(qatorlar[tanlangan].href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOchiq(true)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg border border-line bg-surface-2 text-sm text-muted hover:text-fg transition w-full max-w-md"
      >
        <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left truncate">Kompaniya, foydalanuvchi, to&apos;lov...</span>
        <kbd className="hidden md:inline text-2xs border border-line rounded px-1.5 py-0.5 bg-surface">
          ⌘K
        </kbd>
      </button>

      {ochiq && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 pt-[10vh]"
          onClick={() => setOchiq(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-xl bg-surface rounded-2xl border border-line shadow-raised overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Global qidiruv"
          >
            <div className="flex items-center gap-2 px-4 border-b border-line">
              <Search className="w-4 h-4 text-faint" aria-hidden="true" />
              <input
                ref={input}
                value={matn}
                onChange={(e) => {
                  setMatn(e.target.value);
                  setTanlangan(0);
                }}
                onKeyDown={klavishNav}
                placeholder="Qidirish yoki bo'limga o'tish..."
                className="flex-1 h-12 bg-transparent text-sm text-fg focus:outline-none"
                aria-label="Qidiruv matni"
              />
              {yuklanmoqda && (
                <span className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
              )}
            </div>

            <ul className="max-h-80 overflow-y-auto py-2" role="listbox">
              {qatorlar.length === 0 && (
                <li className="px-4 py-6 text-sm text-muted text-center">
                  {past.length < 2 ? "Kamida 2 belgi kiriting" : "Hech narsa topilmadi"}
                </li>
              )}
              {qatorlar.map((q, i) => (
                <li key={`${q.turi}-${q.href}-${i}`} role="option" aria-selected={i === tanlangan}>
                  <button
                    type="button"
                    onClick={() => otish(q.href)}
                    onMouseEnter={() => setTanlangan(i)}
                    className={cn(
                      "w-full text-left px-4 py-2 flex items-center gap-3",
                      i === tanlangan ? "bg-brand-wash" : "hover:bg-surface-2"
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-fg truncate">{q.sarlavha}</span>
                      <span className="block text-2xs text-muted truncate">{q.izoh}</span>
                    </span>
                    <span className="text-2xs text-faint shrink-0">{q.turi}</span>
                    {i === tanlangan && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-faint" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
