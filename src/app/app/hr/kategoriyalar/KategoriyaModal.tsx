"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import { parseSomInput } from "@/lib/format";
import { KATEGORIYA_TURLARI, KATEGORIYA_TURI_NOMI, type KategoriyaTuri } from "@/lib/validation/xodimKategoriya";
import type { KategoriyaDTO } from "@/lib/services/xodimKategoriya";
import { XodimAvatar } from "../XodimAvatar";

/**
 * Tez to'ldirish uchun TAKLIFLAR — bazaga yozilmaydi, faqat nom maydonini
 * to'ldiradi. Har biznes o'zi xohlagan nomni yozadi (Animator, Fotograf...).
 */
const TAKLIFLAR: { nomi: string; turi: KategoriyaTuri; kop?: boolean }[] = [
  { nomi: "Sotuvchi", turi: "sotuvchi" },
  { nomi: "Animator / Igrushka", turi: "ijrochi", kop: true },
  { nomi: "Shofyor", turi: "ijrochi" },
  { nomi: "Diktor", turi: "ijrochi" },
  { nomi: "Videochi", turi: "ijrochi", kop: true },
  { nomi: "Bezakchi", turi: "ijrochi", kop: true },
  { nomi: "Dizayner", turi: "ijrochi" },
  { nomi: "Fotograf", turi: "ijrochi" },
  { nomi: "Montajchi", turi: "ijrochi" },
  { nomi: "Operator", turi: "ijrochi" },
  { nomi: "Dekorator", turi: "ijrochi", kop: true },
  { nomi: "Kuryer", turi: "ijrochi" },
];

export function KategoriyaModal({
  kategoriya,
  onClose,
  onDone,
}: {
  /** null — yangi kategoriya. */
  kategoriya: KategoriyaDTO | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [nomi, setNomi] = useState(kategoriya?.nomi ?? "");
  const [turi, setTuri] = useState<KategoriyaTuri>(
    (kategoriya?.turi as KategoriyaTuri) ?? "ijrochi"
  );
  const [zakazga, setZakazga] = useState(kategoriya?.zakazgaBiriktiriladi ?? true);
  const [kopXodim, setKopXodim] = useState(kategoriya?.kopXodim ?? false);
  const [zakazHaqi, setZakazHaqi] = useState(String(kategoriya?.zakazHaqi ?? 0));
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saqlash(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    const res = await fetch(
      kategoriya ? `/api/hr/kategoriyalar/${kategoriya.id}` : "/api/hr/kategoriyalar",
      {
        method: kategoriya ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomi, turi, zakazgaBiriktiriladi: zakazga, kopXodim,
          zakazHaqi: zakazHaqi ? parseSomInput(zakazHaqi) : 0,
        }),
      }
    );
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Xatolik yuz berdi");
      return;
    }
    onDone();
  }

  return (
    <Modal open onClose={onClose} title={kategoriya ? "Lavozimni tahrirlash" : "Yangi lavozim"}>
      <form onSubmit={saqlash} className="space-y-3">
        {!kategoriya && (
          <div className="flex flex-wrap gap-1.5">
            {TAKLIFLAR.map((t) => (
              <button
                key={t.nomi}
                type="button"
                onClick={() => {
                  setNomi(t.nomi);
                  setTuri(t.turi);
                  setKopXodim(Boolean(t.kop));
                }}
                className="px-2.5 py-1 rounded-full text-xs border border-line text-muted hover:border-brand/50 hover:text-fg transition"
              >
                {t.nomi}
              </button>
            ))}
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-xs text-muted">Lavozim nomi</span>
          <input
            autoFocus
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            placeholder="Masalan: Sotuvchi"
            className={INPUT_CLASS}
            required
            maxLength={60}
          />
        </label>

        <div className="space-y-1">
          <label className="block text-xs text-muted" htmlFor="kat-turi">KPI turi</label>
          <Select
            id="kat-turi"
            value={turi}
            onChange={(v) => setTuri(v as KategoriyaTuri)}
            options={KATEGORIYA_TURLARI.map((t) => ({ value: t, label: KATEGORIYA_TURI_NOMI[t] }))}
          />
          <span className="block text-2xs text-faint">
            Sotuv KPI — summa/konversiya (zakaz kimniki); Ijro KPI — bajarilgan ish soni.
          </span>
        </div>

        <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            checked={zakazga}
            onChange={(e) => setZakazga(e.target.checked)}
            className="accent-brand w-4 h-4 mt-1"
          />
          <span>
            <span className="block text-sm text-fg">Zakazga biriktirish mumkin</span>
            <span className="block text-2xs text-faint">
              O&apos;chirilsa lavozim faqat HR ro&apos;yxatida qoladi (masalan Administrator) — zakaz
              formasida chiqmaydi.
            </span>
          </span>
        </label>
        {turi !== "sotuvchi" && (
          <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={kopXodim}
              onChange={(e) => setKopXodim(e.target.checked)}
              className="accent-brand w-4 h-4 mt-1"
            />
            <span>
              <span className="block text-sm text-fg">Bir zakazga bir nechta xodim</span>
              <span className="block text-2xs text-faint">
                Videochilar, bezakchilar kabi — bitta zakazga bir nechta xodim tanlanadi.
              </span>
            </span>
          </label>
        )}

        {turi !== "sotuvchi" && (
          <label className="block space-y-1">
            <span className="block text-xs text-muted">Bir zakaz uchun haq (so&apos;m)</span>
            <input
              value={zakazHaqi}
              onChange={(e) => setZakazHaqi(e.target.value)}
              inputMode="numeric"
              placeholder="0"
              className={INPUT_CLASS}
            />
            <span className="block text-2xs text-faint">
              Xodimning oyligiga shu lavozimdagi TASDIQLANGAN zakaz soni &times; haq bo&apos;lib
              qo&apos;shiladi. 0 — zakaz soniga qarab to&apos;lanmaydi. Tizim hisobi shart emas.
            </span>
          </label>
        )}

        {xato && <p className="text-expense text-sm">{xato}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onClose}>
            Bekor
          </Button>
          <Button type="submit" loading={loading}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
