"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";

export interface TaminotchiQisqa {
  id: string;
  nomi: string;
}

/**
 * YANGI TA'MINOTCHI — uchta maydon, ikkitasi ixtiyoriy.
 *
 * Manzil, INN, shartnoma raqami va h.k. ATAYLAB yo'q: gul do'koni "Toshkent
 * Gul" deb yozadi va davom etadi. Kengroq kartochka kerak bo'lsa u
 * ta'minotchilar reyestrida tahrirlanadi.
 *
 * Saqlangandan keyin ta'minotchi DARHOL tanlangan bo'ladi — foydalanuvchi
 * yana ro'yxatdan qidirib o'tirmaydi.
 */
export function YangiTaminotchi({
  boshlangichNomi,
  onBekor,
  onDone,
}: {
  boshlangichNomi?: string;
  onBekor: () => void;
  onDone: (t: TaminotchiQisqa) => void;
}) {
  const [nomi, setNomi] = useState(boshlangichNomi ?? "");
  const [tel, setTel] = useState("");
  const [izoh, setIzoh] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setXato(null);
    setSaqlanmoqda(true);
    try {
      const res = await fetch("/api/ombor/taminotchilar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomi: nomi.trim(),
          tel: tel.trim() || null,
          izoh: izoh.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setXato(data.error ?? "Ta'minotchini saqlab bo'lmadi");
        return;
      }
      onDone({ id: data.id, nomi: data.nomi });
    } finally {
      setSaqlanmoqda(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={LABEL_CLASS} htmlFor="yt-nomi">
          Nomi
        </label>
        <input
          id="yt-nomi"
          value={nomi}
          onChange={(e) => setNomi(e.target.value)}
          placeholder="Masalan: Toshkent Gul"
          className={INPUT_CLASS}
          maxLength={120}
          required
          autoFocus
        />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="yt-tel">
          Telefon <span className="text-muted font-normal">(ixtiyoriy)</span>
        </label>
        <input
          id="yt-tel"
          type="tel"
          inputMode="tel"
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          placeholder="+998 ..."
          className={INPUT_CLASS}
          maxLength={50}
        />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="yt-izoh">
          Izoh <span className="text-muted font-normal">(ixtiyoriy)</span>
        </label>
        <input
          id="yt-izoh"
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          className={INPUT_CLASS}
          maxLength={500}
        />
      </div>

      {xato && <p className="text-sm text-expense">{xato}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" type="button" onClick={onBekor} className="flex-1">
          Bekor
        </Button>
        <Button type="submit" loading={saqlanmoqda} className="flex-[2]">
          Saqlash
        </Button>
      </div>
    </form>
  );
}
