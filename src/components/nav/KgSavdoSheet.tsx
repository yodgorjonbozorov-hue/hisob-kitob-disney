"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import { kgSumma, kgToGram, parseKgInput } from "@/lib/kg";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * KG SAVDOSI OYNASI (mijozga xos — Fortex Selos, lib/mijozXos.ts).
 *
 * "Selos" kabi kg kategoriyasi bosilganda summa EMAS, ikki qiymat so'raladi:
 * miqdor (kg) va 1 kg narxi. Jami avtomatik hisoblanadi va server tomonda
 * QAYTA hisoblanadi (bu yerdagi son faqat ko'rsatish uchun).
 *
 * Narx qotirilmagan: har savdoda erkin kiritiladi. Oxirgi narx boshlang'ich
 * qiymat sifatida taklif qilinadi — sotuvchi 5–10 soniyada kiritishi kerak.
 */
export function KgSavdoSheet({
  open,
  kategoriya,
  onClose,
  onSaved,
}: {
  open: boolean;
  kategoriya: { id: string; nomi: string; oxirgiKgNarxi?: number | null } | null;
  /** Bekor / fon bosilganda — chaqiruvchi oyna ochiq qoladi. */
  onClose: () => void;
  /** Saqlangandan keyin (chaqiruvchi oyna ham yopiladi). Berilmasa `onClose`. */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [miqdorText, setMiqdorText] = useState("");
  const [narxText, setNarxText] = useState("");
  const [izoh, setIzoh] = useState("");
  const [kecha, setKecha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMiqdorText("");
    setIzoh("");
    setKecha(false);
    setError(null);
    // Oxirgi savdodagi narx — faqat TAKLIF, sotuvchi o'zgartira oladi.
    setNarxText(kategoriya?.oxirgiKgNarxi ? formatSom(kategoriya.oxirgiKgNarxi) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kategoriya?.id]);

  const miqdorKg = parseKgInput(miqdorText);
  const kgNarxi = parseSomInput(narxText);
  const jami = miqdorKg > 0 && kgNarxi > 0 ? kgSumma(kgToGram(miqdorKg), kgNarxi) : 0;

  async function submit() {
    setError(null);
    if (!kategoriya) return;
    if (miqdorKg <= 0) return setError("Miqdorni (kg) kiriting");
    if (kgNarxi <= 0) return setError("1 kg narxini kiriting");
    setLoading(true);
    try {
      const sana = kecha
        ? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
        : todayDateOnlyString();
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `summa` server tomonda miqdor × narx bo'yicha qayta hisoblanadi.
        body: JSON.stringify({
          turi: "kirim",
          categoryId: kategoriya.id,
          summa: jami,
          miqdorKg,
          kgNarxi,
          sana,
          izoh: izoh || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Xatolik yuz berdi");
      router.refresh();
      (onSaved ?? onClose)();
      toast({
        message: `${kategoriya.nomi} · ${miqdorText.replace(".", ",")} kg × ${formatSom(kgNarxi)} = ${formatSomLabel(data.summa ?? jami)}`,
        tone: "success",
        action: data.id
          ? {
              label: "Bekor qilish",
              onClick: async () => {
                await fetch(`/api/transactions/${data.id}`, { method: "DELETE" });
                router.refresh();
              },
            }
          : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  if (!open || !kategoriya) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 animate-fade-in"
      // Bosilishi chaqiruvchi oynaning fon handleriga YETIB BORMASLIGI kerak,
      // aks holda ikkala oyna birga yopilardi.
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${kategoriya.nomi} savdosi`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-app text-fg w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl pb-safe max-h-[94vh] overflow-y-auto animate-slide-up"
      >
        <div className="w-10 h-1 rounded-full bg-line-strong mx-auto my-3" />

        <div className="px-5">
          <p className="text-2xs text-faint uppercase tracking-wide">Kg savdosi</p>
          <h2 className="font-display text-xl font-bold text-fg">{kategoriya.nomi}</h2>
        </div>

        <div className="px-5 mt-4 space-y-3">
          <label className="block">
            <span className="text-sm text-muted">Miqdor (kg)</span>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              value={miqdorText}
              onChange={(e) => setMiqdorText(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="100"
              className="mt-1 w-full h-14 rounded-xl border border-line bg-surface px-4 text-2xl font-display tnum text-fg"
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted">1 kg narxi (soʻm)</span>
            <input
              type="text"
              inputMode="numeric"
              value={narxText}
              onChange={(e) => setNarxText(formatSom(parseSomInput(e.target.value)))}
              placeholder="5 000"
              className="mt-1 w-full h-14 rounded-xl border border-line bg-surface px-4 text-2xl font-display tnum text-fg"
            />
          </label>

          {/* Jami — hisob ko'rinib turishi shart: sotuvchi xato raqamni shu
              yerda tutadi. Server baribir qayta hisoblaydi. */}
          <div className="rounded-xl bg-income-soft border border-income/30 px-4 py-3">
            <p className="text-2xs text-faint uppercase tracking-wide">Jami</p>
            <p className="font-display text-3xl tnum text-income">
              {formatSom(jami)} <span className="text-lg text-faint font-sans">soʻm</span>
            </p>
            {miqdorKg > 0 && kgNarxi > 0 && (
              <p className="text-2xs text-muted tnum mt-0.5">
                {miqdorText.replace(".", ",")} kg × {formatSom(kgNarxi)} soʻm
              </p>
            )}
          </div>

          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={izoh}
              onChange={(e) => setIzoh(e.target.value)}
              placeholder="Izoh (ixtiyoriy)"
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-base"
            />
            <button
              onClick={() => setKecha((k) => !k)}
              className={`shrink-0 h-11 px-3 rounded-lg text-sm font-medium border ${
                kecha ? "bg-brand-wash text-brand border-brand" : "bg-surface text-muted border-line"
              }`}
            >
              {kecha ? "Kecha" : "Bugun"} ▾
            </button>
          </div>
        </div>

        {error && <p className="px-5 mt-2 text-expense text-sm">{error}</p>}

        <div className="sticky bottom-0 bg-app px-5 py-3 mt-3 flex gap-2 border-t border-line">
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">
            Bekor
          </Button>
          <Button size="lg" loading={loading} onClick={submit} className="flex-[2]">
            Saqlash
          </Button>
        </div>
      </div>
    </div>
  );
}
