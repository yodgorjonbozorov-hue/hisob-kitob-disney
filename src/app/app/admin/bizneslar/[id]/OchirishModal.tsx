"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * BIZNESNI BUTUNLAY O'CHIRISH — tasdiqlash oynasi.
 *
 * Frontend tasdig'i XAVFSIZLIK EMAS, faqat tasodifiy bosishdan himoya:
 * server ham (a) DIREKTOR (OWNER) rolini, (b) so'rov tanasidagi biznes
 * nomining aynan mosligini va (c) biznesning BO'SH ekanini tekshiradi
 * (api/businesses/[id] → DELETE).
 */
export function OchirishModal({
  biznes,
  onClose,
  onDone,
}: {
  biznes: { id: string; nomi: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [nomi, setNomi] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const mos = nomi.trim() === biznes.nomi.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!mos || loading) return;
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/businesses/${biznes.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasdiqNomi: nomi.trim() }),
      });
      if (!res.ok) {
        setXato((await res.json()).error ?? "O'chirib bo'lmadi");
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
    <Modal open onClose={onClose} title="Biznesni butunlay o'chirish">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-expense/40 bg-expense-soft p-3 text-sm text-expense-fg">
          <p className="font-medium">Bu amalni qaytarib bo&apos;lmaydi.</p>
          <p className="mt-1 text-xs">
            Biznes va uning sozlamalari (kassalar, kategoriyalar, budjetlar, takroriy to&apos;lovlar)
            o&apos;chadi.
          </p>
          <p className="mt-1 text-xs">
            Faqat BO&apos;SH biznes o&apos;chadi: yozuv, mahsulot, sotuv, qarz yoki biriktirilgan
            foydalanuvchi bo&apos;lsa server rad etadi — ma&apos;lumot yo&apos;qolmaydi. Bunday
            holda biznesni &quot;Nofaollashtiring&quot;.
          </p>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="och-nomi">
            Tasdiqlash uchun biznes nomini yozing:{" "}
            <span className="text-fg font-medium">{biznes.nomi}</span>
          </label>
          <input
            id="och-nomi"
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            placeholder={biznes.nomi}
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg"
            autoFocus
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        {!mos && (
          <p className="text-2xs text-faint">
            {nomi.trim().length === 0
              ? "Tugma faollashishi uchun yuqoridagi maydonga biznes nomini qo'lda yozing."
              : `Nom mos kelmadi — aynan "${biznes.nomi}" deb yozing.`}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="danger" disabled={!mos} loading={loading}>
            Biznesni butunlay o&apos;chirish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
