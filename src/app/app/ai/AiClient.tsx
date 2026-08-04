"use client";

import { useRef, useState } from "react";

interface Xabar {
  rol: "user" | "assistant";
  matn: string;
}

const TAYYOR_SAVOLLAR = [
  "Bu oy qanday o'tyapti?",
  "Qaysi chiqimlar oshgan?",
  "Qarzdorlik holati qanday?",
  "So'nggi oylar dinamikasini tahlil qil",
];

/** AI suhbat oynasi — oddiy so'rov/javob (v1, streaming'siz). */
export function AiClient() {
  // Ekrandagi xabarlar faqat KO'RSATISH uchun. Modelga yuboriladigan tarix
  // serverda saqlanadi (lib/ai/suhbat.ts) — mijoz soxta "assistant" xabari
  // bilan modelni chalg'ita olmasligi uchun.
  const [xabarlar, setXabarlar] = useState<Xabar[]>([]);
  const [savol, setSavol] = useState("");
  const [kutilmoqda, setKutilmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const pastRef = useRef<HTMLDivElement>(null);

  async function yuborish(matn: string, yangiSuhbat = false) {
    const s = matn.trim();
    if (!s || kutilmoqda) return;
    setXato(null);
    setSavol("");
    const yangiTarix: Xabar[] = yangiSuhbat ? [{ rol: "user", matn: s }] : [...xabarlar, { rol: "user", matn: s }];
    setXabarlar(yangiTarix);
    setKutilmoqda(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savol: s, ...(yangiSuhbat ? { yangiSuhbat: true } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        setXabarlar(xabarlar); // savolni qaytarib olamiz
        setSavol(s);
        return;
      }
      setXabarlar([...yangiTarix, { rol: "assistant", matn: data.javob }]);
      setTimeout(() => pastRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      setXato("Serverga ulanib bo'lmadi");
      setXabarlar(xabarlar);
      setSavol(s);
    } finally {
      setKutilmoqda(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Suhbat */}
      <div className="bg-surface rounded-2xl border border-line p-4 min-h-[300px] max-h-[55vh] overflow-y-auto space-y-3">
        {xabarlar.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <p className="text-3xl">✨</p>
            <p className="text-sm text-muted">
              Biznesingiz raqamlari bo'yicha istalgan savolni bering — AI faqat sizning
              ma'lumotingizni ko'radi.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {TAYYOR_SAVOLLAR.map((s) => (
                <button
                  key={s}
                  onClick={() => yuborish(s)}
                  className="px-3 py-1.5 rounded-full text-xs border border-line text-muted hover:border-brand hover:text-brand transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {xabarlar.map((x, i) => (
          <div key={i} className={`flex ${x.rol === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                x.rol === "user" ? "bg-brand text-white" : "bg-surface-2 text-fg"
              }`}
            >
              {x.matn}
            </div>
          </div>
        ))}
        {kutilmoqda && (
          <div className="flex justify-start">
            <div className="bg-surface-2 rounded-2xl px-4 py-2.5 text-sm text-muted animate-pulse">
              O'ylayapman...
            </div>
          </div>
        )}
        <div ref={pastRef} />
      </div>

      {xato && <p className="text-expense text-sm">{xato}</p>}

      {/* Kiritish */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void yuborish(savol);
        }}
        className="flex gap-2"
      >
        <input
          value={savol}
          onChange={(e) => setSavol(e.target.value)}
          placeholder="Savolingizni yozing..."
          disabled={kutilmoqda}
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={kutilmoqda || !savol.trim()}
          className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-medium disabled:opacity-50"
        >
          Yuborish
        </button>
      </form>
      <p className="text-2xs text-faint">
        AI xato qilishi mumkin — muhim qarorlar oldidan raqamlarni hisobotlarda tekshiring.
      </p>
    </div>
  );
}
