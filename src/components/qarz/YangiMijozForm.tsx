"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { MijozTanlov } from "./MijozTanlash";

/**
 * "+ YANGI MIJOZ" — qarz/sotuv oynasi ichida ochiladigan panel.
 *
 * ATAYLAB oyna ustiga oyna emas: kassir qarz yozayotganda ikkinchi modal
 * ochilishi ishni sekinlashtiradi va telefonda umuman noqulay. Panel shu
 * yerda ochiladi, saqlangach yopiladi va mijoz tanlangan holatga o'tadi.
 *
 * Kartochka DARHOL yaratiladi (`POST /api/debts/mijozlar`), sotuv
 * yakunlanishini kutmasdan — "saqladimmi yoki yo'qmi" degan ikkilanish
 * qolmasin. Takrorlanishdan himoya serverda (`mijozniAniqlaTx`).
 */
export function YangiMijozForm({
  boshlangichIsm,
  onYaratildi,
  onBekor,
}: {
  /** Qidiruv maydoniga yozilgan matn — ism sifatida oldindan to'ldiriladi. */
  boshlangichIsm?: string;
  onYaratildi: (m: MijozTanlov) => void;
  onBekor: () => void;
}) {
  const [ism, setIsm] = useState(boshlangichIsm?.trim() ?? "");
  const [tel, setTel] = useState("");
  const [izoh, setIzoh] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  async function saqla(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setXato(null);
    if (!ism.trim()) {
      setXato("Ism kiritilishi shart");
      return;
    }
    setSaqlanmoqda(true);
    try {
      const res = await fetch("/api/debts/mijozlar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ism: ism.trim(),
          tel: tel.trim() || undefined,
          izoh: izoh.trim() || undefined,
        }),
      });
      const javob = await res.json();
      if (!res.ok) {
        setXato(javob.error ?? "Mijozni saqlab bo'lmadi");
        return;
      }
      onYaratildi({
        contactId: javob.contactId ?? null,
        ism: javob.ism ?? ism.trim(),
        tel: javob.tel ?? tel.trim(),
        ochiqQarz: javob.ochiqQarz ?? 0,
      });
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setSaqlanmoqda(false);
    }
  }

  return (
    // Ota forma ichida `<form>` bo'lishi mumkin emas — shuning uchun `div`
    // va tugmalar `type="button"`; saqlash qo'lda chaqiriladi.
    <div className="rounded-lg border border-brand/40 bg-brand/5 p-3 space-y-2">
      <p className="text-xs font-medium text-brand">Yangi mijoz</p>

      <div>
        <label className="block text-2xs text-muted mb-1" htmlFor="yangi-mijoz-ism">
          Ism familiya <span className="text-expense">*</span>
        </label>
        <input
          id="yangi-mijoz-ism"
          value={ism}
          onChange={(e) => setIsm(e.target.value)}
          placeholder="Ali Valiyev"
          autoFocus
          className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
        />
      </div>

      <div>
        <label className="block text-2xs text-muted mb-1" htmlFor="yangi-mijoz-tel">
          Telefon raqami
        </label>
        <input
          id="yangi-mijoz-tel"
          type="tel"
          inputMode="tel"
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          placeholder="+998 __ ___ __ __"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
        />
      </div>

      <div>
        <label className="block text-2xs text-muted mb-1" htmlFor="yangi-mijoz-izoh">
          Izoh
        </label>
        <input
          id="yangi-mijoz-izoh"
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          placeholder="Masalan: qo'shni do'kon"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
        />
      </div>

      {xato && <p className="text-2xs text-expense-fg">{xato}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onBekor} disabled={saqlanmoqda}>
          Bekor
        </Button>
        <Button type="button" onClick={saqla} loading={saqlanmoqda}>
          Saqlash
        </Button>
      </div>
    </div>
  );
}
