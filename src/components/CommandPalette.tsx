"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isManager, type Rol } from "@/lib/auth/roles";
import { formatSomLabel } from "@/lib/format";

interface BusinessOption {
  id: string;
  nomi: string;
}
interface Item {
  key: string;
  label: string;
  sub?: string;
  group: string;
  action: () => void;
}

/**
 * ⌘K / Ctrl+K command palette — sahifalarga o'tish, biznes almashtirish va
 * global qidiruv (tranzaksiya/qarzdor/mahsulot/kategoriya).
 */
export function CommandPalette({
  rol,
  omborli,
  businesses,
  activeBusinessId,
}: {
  rol: Rol;
  omborli: boolean;
  businesses: BusinessOption[];
  activeBusinessId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAdmin = isManager(rol);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults([]);
    setActive(0);
  }, []);

  // ⌘K / Ctrl+K global
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Navigatsiya buyruqlari (rol/omborli asosida)
  const navCommands: Item[] = [];
  const nav = (href: string, label: string) =>
    navCommands.push({ key: `nav:${href}`, label, group: "O'tish", action: () => { router.push(href); close(); } });
  if (isAdmin) nav("/", "Boshqaruv paneli");
  nav("/tranzaksiyalar", "Tranzaksiyalar");
  if (isAdmin) nav("/hisobot", "Oylik hisobot");
  if (isAdmin) nav("/byudjet", "Budjet");
  // Sotuvchi faqat kirim/chiqim kiritadi — ombor/sotuv/qarzlar unga ko'rinmaydi.
  if (omborli && rol !== "SELLER") {
    if (isAdmin) nav("/ombor", "Ombor");
    nav("/sotuv", "Sotuv");
    nav("/qarzlar", "Qarzlar");
  }
  if (isAdmin) {
    nav("/admin/foydalanuvchilar", "Foydalanuvchilar");
    nav("/admin/audit", "Audit jurnali");
    nav("/admin/ochirilganlar", "O'chirilganlar");
  }

  const bizCommands: Item[] = businesses
    .filter((b) => b.id !== activeBusinessId && rol !== "CASHIER")
    .map((b) => ({
      key: `biz:${b.id}`,
      label: `Biznes: ${b.nomi}`,
      group: "Biznes almashtirish",
      action: async () => {
        await fetch("/api/me/active-business", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId: b.id }),
        });
        router.refresh();
        close();
      },
    }));

  // Qidiruv (debounce)
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        if (!res.ok) return;
        const data = await res.json();
        const items: Item[] = [];
        for (const t of data.transactions ?? []) {
          items.push({
            key: `tx:${t.id}`,
            label: `${t.categoryNomi} — ${formatSomLabel(t.summa)}`,
            sub: t.izoh ?? undefined,
            group: "Tranzaksiyalar",
            action: () => { router.push("/tranzaksiyalar"); close(); },
          });
        }
        for (const d of data.debtors ?? []) {
          items.push({
            key: `debt:${d.id}`,
            label: `${d.mijozNomi}`,
            sub: `Qolgan: ${formatSomLabel(d.qolgan)}`,
            group: "Qarzdorlar",
            action: () => { router.push("/qarzlar"); close(); },
          });
        }
        for (const p of data.products ?? []) {
          items.push({ key: `prod:${p.id}`, label: p.nomi, group: "Mahsulotlar", action: () => { router.push(isAdmin ? "/ombor" : "/sotuv"); close(); } });
        }
        for (const c of data.categories ?? []) {
          items.push({ key: `cat:${c.id}`, label: c.nomi, sub: c.turi, group: "Kategoriyalar", action: () => { router.push("/admin/kategoriyalar"); close(); } });
        }
        setResults(items);
        setActive(0);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Ko'rsatiladigan yakuniy ro'yxat
  const ql = q.trim().toLowerCase();
  const filteredNav = ql
    ? [...navCommands, ...bizCommands].filter((i) => i.label.toLowerCase().includes(ql))
    : [...navCommands, ...bizCommands];
  const items = ql.length >= 2 ? [...filteredNav, ...results] : filteredNav;

  // Guruhlash
  const groups: { name: string; items: Item[] }[] = [];
  for (const it of items) {
    let g = groups.find((x) => x.name === it.group);
    if (!g) { g = { name: it.group, items: [] }; groups.push(g); }
    g.items.push(it);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); items[active]?.action(); }
    else if (e.key === "Escape") { close(); }
  }

  if (!open) return null;

  let flatIndex = -1;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[10vh] px-4 bg-black/40 animate-fade-in" onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface rounded-2xl shadow-xl border border-line overflow-hidden"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Qidirish yoki o'tish... (⌘K)"
          className="w-full px-4 py-3.5 text-base bg-transparent border-b border-line focus:outline-none"
        />
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {items.length === 0 && (
            <p className="text-center text-muted text-sm py-8">Natija yo'q</p>
          )}
          {groups.map((g) => (
            <div key={g.name} className="mb-1">
              <p className="text-2xs uppercase text-faint px-4 py-1">{g.name}</p>
              {g.items.map((it) => {
                flatIndex++;
                const idx = flatIndex;
                return (
                  <button
                    key={it.key}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => it.action()}
                    className={`w-full text-left px-4 py-2 flex flex-col ${idx === active ? "bg-surface-2" : ""}`}
                  >
                    <span className="text-sm text-fg">{it.label}</span>
                    {it.sub && <span className="text-2xs text-muted truncate">{it.sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
