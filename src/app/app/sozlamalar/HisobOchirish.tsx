"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

/**
 * Hisobni butunlay o'chirish (App Store 5.1.1(v)).
 *
 * Ataylab OG'IR: kompaniya nomini qo'lda yozmaguncha tugma ochilmaydi —
 * tasodifan bosib yuborish mumkin emas. So'rovdan keyin 30 kun ichida bekor
 * qilish yo'li ochiq qoladi ("Hisob o'chirilmoqda" sahifasida).
 */
export function HisobOchirish({ kompaniyaNomi }: { kompaniyaNomi: string }) {
  const [ochiq, setOchiq] = useState(false);
  const [tasdiq, setTasdiq] = useState("");
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const mos = tasdiq.trim().toLowerCase() === kompaniyaNomi.trim().toLowerCase();

  async function yubor() {
    setBand(true);
    setXato(null);
    try {
      const res = await fetch("/api/me/hisob-ochirish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasdiq }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "So'rov yuborilmadi");
      }
      // Guard endi barcha ish sahifalarini yopadi va shu sahifaga yo'naltiradi.
      window.location.href = "/hisob-ochirilmoqda";
    } catch (e) {
      setXato(e instanceof Error ? e.message : "So'rov yuborilmadi");
      setBand(false);
    }
  }

  return (
    <div className="bg-surface rounded-2xl border border-expense/40 shadow-card p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-expense-soft text-expense-fg flex items-center justify-center shrink-0">
          <TriangleAlert className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-fg">Hisobni o&apos;chirish</p>
          <p className="text-sm text-muted mt-1">
            <span className="font-medium text-fg">{kompaniyaNomi}</span> kompaniyasini va unga
            tegishli barcha ma&apos;lumotni — yozuvlar, ombor, qarzlar, hisobotlar va xodimlar
            hisoblarini — butunlay o&apos;chiradi.
          </p>

          {!ochiq ? (
            <button
              type="button"
              onClick={() => setOchiq(true)}
              className="mt-4 px-4 py-2 rounded-lg border border-expense/50 text-expense-fg text-sm font-medium"
            >
              Hisobni o&apos;chirish
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-expense-soft text-expense-fg px-4 py-3 text-sm">
                O&apos;chirish so&apos;ralgandan keyin ilovaga kirish darhol yopiladi.
                Ma&apos;lumotlar 30 kun saqlanadi — shu muddat ichida fikringizdan
                qaytsangiz o&apos;chirishni bekor qila olasiz. 30 kundan keyin hamma narsa
                butunlay o&apos;chadi va tiklab bo&apos;lmaydi.
              </div>

              <label className="block text-sm">
                <span className="text-muted">
                  Tasdiqlash uchun kompaniya nomini yozing:{" "}
                  <span className="font-medium text-fg">{kompaniyaNomi}</span>
                </span>
                <input
                  type="text"
                  value={tasdiq}
                  onChange={(e) => setTasdiq(e.target.value)}
                  autoComplete="off"
                  className="mt-1.5 w-full px-3 py-2 rounded-lg border border-line bg-app text-fg"
                  placeholder={kompaniyaNomi}
                />
              </label>

              {xato && <p className="text-sm text-expense-fg">{xato}</p>}

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={!mos || band}
                  onClick={() => void yubor()}
                  className="px-4 py-2 rounded-lg bg-expense text-white text-sm font-semibold disabled:opacity-40"
                >
                  {band ? "Yuborilmoqda…" : "Butunlay o'chirish"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOchiq(false);
                    setTasdiq("");
                    setXato(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-line text-fg text-sm"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
