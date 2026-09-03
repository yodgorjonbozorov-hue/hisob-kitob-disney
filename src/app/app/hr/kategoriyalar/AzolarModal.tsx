"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import { XodimAvatar } from "../XodimAvatar";
import type { KategoriyaDTO } from "@/lib/services/xodimKategoriya";

/**
 * LAVOZIM A'ZOLARI — kim shu lavozimda ishlaydi.
 *
 * A'zolik TO'LIQ almashtiriladi (tanlangan ro'yxat serverga o'sha holicha
 * yuboriladi). Zakaz formasidagi selektorlar aynan shu ro'yxatdan quriladi:
 * a'zo bo'lmagan xodim zakazga biriktirilmaydi (server ham majburlaydi).
 */
export interface XodimTanlovDTO {
  id: string;
  ism: string;
  rasmUrl: string | null;
}

/** Kategoriya a'zoligini tanlash — checkbox ro'yxati (to'liq almashtiradi). */
export function AzolarModal({
  kategoriya,
  xodimlar,
  onClose,
  onDone,
}: {
  kategoriya: KategoriyaDTO;
  xodimlar: XodimTanlovDTO[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [tanlangan, setTanlangan] = useState<Set<string>>(
    () => new Set(kategoriya.azolar.map((a) => a.id))
  );
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function almash(id: string) {
    setTanlangan((old) => {
      const yangi = new Set(old);
      if (yangi.has(id)) yangi.delete(id);
      else yangi.add(id);
      return yangi;
    });
  }

  async function saqlash() {
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/hr/kategoriyalar/${kategoriya.id}/azolar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeIds: [...tanlangan] }),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Xatolik yuz berdi");
      return;
    }
    onDone();
  }

  return (
    <Modal open onClose={onClose} title={`${kategoriya.nomi} — a'zolar`} size="lg">
      <div className="space-y-3">
        {xodimlar.length === 0 ? (
          <p className="text-sm text-muted">
            Faol xodim yo&apos;q. Avval Xodimlar bo&apos;limida xodim qo&apos;shing.
          </p>
        ) : (
          <ul className="divide-y divide-line max-h-[50vh] overflow-y-auto">
            {xodimlar.map((x) => (
              <li key={x.id}>
                <label className="flex items-center gap-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tanlangan.has(x.id)}
                    onChange={() => almash(x.id)}
                    className="accent-brand w-4 h-4"
                  />
                  <XodimAvatar ism={x.ism} rasmUrl={x.rasmUrl} size="sm" />
                  <span className="text-sm text-fg">{x.ism}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {xato && <p className="text-expense text-sm">{xato}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Bekor
          </Button>
          <Button onClick={saqlash} loading={loading} disabled={xodimlar.length === 0}>
            Saqlash ({tanlangan.size})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
