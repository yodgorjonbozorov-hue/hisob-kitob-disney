"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ROL_LABEL, type Rol } from "@/lib/auth/roles";
import type { KunlikNomzodDTO } from "@/lib/queries/kunlik";

/**
 * Kunlik hisobot direktorini tayinlash — faqat boshqaruvchi ochadi.
 * Direktor keyinchalik shu yerdan boshqa foydalanuvchiga almashtiriladi.
 */
export function DirektorModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [nomzodlar, setNomzodlar] = useState<KunlikNomzodDTO[] | null>(null);
  const [tanlangan, setTanlangan] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  useEffect(() => {
    let bekor = false;
    // Xatolar ichkarida ushlanadi — promise ataylab kuzatilmaydi.
    void (async () => {
      try {
        const res = await fetch("/api/kunlik/direktor");
        const data = await res.json();
        if (bekor) return;
        if (!res.ok) {
          setXato(data.error ?? "Yuklab bo'lmadi");
          return;
        }
        setNomzodlar(data.nomzodlar);
        setTanlangan(data.direktor?.direktorId ?? "");
      } catch {
        if (!bekor) setXato("Serverga ulanib bo'lmadi");
      }
    })();
    return () => {
      bekor = true;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kunlik/direktor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direktorId: tanlangan || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Saqlab bo'lmadi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Kunlik hisobot direktori">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">
          Kun yakunini faqat shu yerda tanlangan foydalanuvchi tasdiqlaydi. Tanlanmagan
          bo&apos;lsa — vaqtincha boshqaruvchilar tasdiqlay oladi.
        </p>

        {nomzodlar === null ? (
          <p className="text-sm text-muted">Yuklanmoqda…</p>
        ) : (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="kunlik-direktor">
              Direktor
            </label>
            <select
              id="kunlik-direktor"
              value={tanlangan}
              onChange={(e) => setTanlangan(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg"
            >
              <option value="">— Tayinlanmagan —</option>
              {nomzodlar.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.ism} ({ROL_LABEL[n.rol as Rol] ?? n.rol})
                </option>
              ))}
            </select>
          </div>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading} disabled={nomzodlar === null}>
            Saqlash
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
