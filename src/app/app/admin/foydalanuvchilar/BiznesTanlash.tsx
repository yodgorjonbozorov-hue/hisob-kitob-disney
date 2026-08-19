"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { BusinessOption } from "./turlar";

/**
 * KO'P BIZNES TANLASH (checkbox ro'yxati).
 *
 * Bir jamoa bir nechta biznesni yuritishi mumkin (masalan gullar va sovg'a
 * qutilari — sotuvchilar bir xil, bizneslar esa hisob-kitob chalkashmasligi
 * uchun alohida). Shu bois xodimga bir nechta biznes belgilanadi.
 *
 * Kassir uchun kamida bitta biznes shart (server ham tekshiradi); sotuvchi
 * uchun bo'sh qoldirish mumkin — u holda barcha bizneslarni ko'radi.
 */
export function BiznesTanlash({
  businesses,
  tanlangan,
  onChange,
  kassir,
  disabled,
}: {
  businesses: BusinessOption[];
  tanlangan: string[];
  onChange: (idlar: string[]) => void;
  /** Kassirda "barcha bizneslar" varianti yo'q — kamida bitta tanlanadi. */
  kassir: boolean;
  disabled?: boolean;
}) {
  function toggle(id: string) {
    const yangi = tanlangan.includes(id) ? tanlangan.filter((x) => x !== id) : [...tanlangan, id];
    if (kassir && yangi.length === 0) return;
    onChange(yangi);
  }

  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto">
      {businesses.map((b) => (
        <label
          key={b.id}
          className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm cursor-pointer hover:bg-surface-2"
        >
          <input
            type="checkbox"
            checked={tanlangan.includes(b.id)}
            onChange={() => toggle(b.id)}
            disabled={disabled}
            className="accent-brand"
          />
          <span className="truncate">{b.nomi}</span>
        </label>
      ))}
      {businesses.length === 0 && <p className="text-xs text-faint">Biznes yo'q.</p>}
      {!kassir && tanlangan.length === 0 && (
        <p className="text-2xs text-faint">Hech biri belgilanmasa — barcha bizneslarni ko'radi.</p>
      )}
    </div>
  );
}

/** Xodim bizneslarini o'zgartirish oynasi (jadvaldagi tugmadan ochiladi). */
export function BiznesModal({
  ism,
  businesses,
  boshlangich,
  kassir,
  onClose,
  onSaqla,
}: {
  ism: string;
  businesses: BusinessOption[];
  boshlangich: string[];
  kassir: boolean;
  onClose: () => void;
  onSaqla: (idlar: string[]) => Promise<void>;
}) {
  const [tanlangan, setTanlangan] = useState<string[]>(boshlangich);
  const [loading, setLoading] = useState(false);

  async function saqla() {
    setLoading(true);
    try {
      await onSaqla(tanlangan);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${ism} — bizneslar`}>
      <div className="space-y-3">
        <p className="text-xs text-muted">
          Xodim belgilangan bizneslarning barchasida ishlay oladi va ular orasida almashadi. Yozuvlari
          o'sha paytdagi tanlangan biznesga tushadi.
        </p>
        <BiznesTanlash
          businesses={businesses}
          tanlangan={tanlangan}
          onChange={setTanlangan}
          kassir={kassir}
          disabled={loading}
        />
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="button" onClick={saqla} disabled={loading}>
            {loading ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
