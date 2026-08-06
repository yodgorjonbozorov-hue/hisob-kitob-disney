"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { STAVKA_TURLARI, STAVKA_NOMI, type StavkaTuri } from "@/lib/validation/hr";
import type { XodimDTO } from "@/lib/queries/hr";

export function XodimModal({
  xodim,
  onClose,
  onDone,
}: {
  xodim: XodimDTO | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const tahrir = xodim !== null;
  const [ism, setIsm] = useState(xodim?.ism ?? "");
  const [lavozim, setLavozim] = useState(xodim?.lavozim ?? "");
  const [tel, setTel] = useState(xodim?.tel ?? "");
  const [stavka, setStavka] = useState(xodim ? String(xodim.stavka) : "");
  const [stavkaTuri, setStavkaTuri] = useState<StavkaTuri>(
    (xodim?.stavkaTuri as StavkaTuri) ?? "oylik"
  );
  const [ishBoshlagan, setIshBoshlagan] = useState(
    xodim?.ishBoshlagan ? xodim.ishBoshlagan.slice(0, 10) : ""
  );
  const [izoh, setIzoh] = useState(xodim?.izoh ?? "");
  const [isActive, setIsActive] = useState(xodim?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const son = Number(stavka || 0);
    if (!Number.isInteger(son) || son < 0) {
      setXato("Stavka manfiy bo'lmagan butun son bo'lishi kerak");
      return;
    }

    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(tahrir ? `/api/hr/xodimlar/${xodim!.id}` : "/api/hr/xodimlar", {
        method: tahrir ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ism,
          lavozim: lavozim || null,
          tel: tel || null,
          stavka: son,
          stavkaTuri,
          ishBoshlagan: ishBoshlagan || null,
          izoh: izoh || null,
          ...(tahrir ? { isActive } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  async function ochirish() {
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/hr/xodimlar/${xodim!.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "O'chirib bo'lmadi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

  return (
    <Modal open onClose={onClose} title={tahrir ? "Xodimni tahrirlash" : "Yangi xodim"}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="x-ism">
            Ism
          </label>
          <input id="x-ism" value={ism} onChange={(e) => setIsm(e.target.value)} required maxLength={120} className={input} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="x-lavozim">
              Lavozim
            </label>
            <input id="x-lavozim" value={lavozim} onChange={(e) => setLavozim(e.target.value)} maxLength={100} className={input} />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="x-tel">
              Telefon
            </label>
            <input id="x-tel" value={tel} onChange={(e) => setTel(e.target.value)} maxLength={50} className={input} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="x-stavka">
              Stavka (so&apos;m)
            </label>
            <input
              id="x-stavka"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={stavka}
              onChange={(e) => setStavka(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="x-turi">
              Stavka turi
            </label>
            <select
              id="x-turi"
              value={stavkaTuri}
              onChange={(e) => setStavkaTuri(e.target.value as StavkaTuri)}
              className={input}
            >
              {STAVKA_TURLARI.map((t) => (
                <option key={t} value={t}>
                  {STAVKA_NOMI[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-2xs text-faint">
          Kunlik stavkada oylik davomat jadvalidan hisoblanadi; oylik stavkada esa to&apos;liq
          stavka olinadi va kam ishlagani &laquo;ushlab qolish&raquo; bilan hisobga olinadi.
        </p>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="x-ish">
            Ishga kirgan sana
          </label>
          <input
            id="x-ish"
            type="date"
            value={ishBoshlagan}
            onChange={(e) => setIshBoshlagan(e.target.value)}
            className={input}
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="x-izoh">
            Izoh
          </label>
          <input id="x-izoh" value={izoh} onChange={(e) => setIzoh(e.target.value)} maxLength={500} className={input} />
        </div>

        {tahrir && (
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
            Ishlayapti (nofaol xodim vedomostga tushmaydi)
          </label>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            {tahrir ? "Saqlash" : "Qo'shish"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          {tahrir && (
            <Button variant="ghost" onClick={ochirish} disabled={loading}>
              O&apos;chirish
            </Button>
          )}
        </div>
        {tahrir && (
          <p className="text-2xs text-faint">
            O&apos;chirilgan xodimning oylik va davomat tarixi saqlanadi.
          </p>
        )}
      </form>
    </Modal>
  );
}
