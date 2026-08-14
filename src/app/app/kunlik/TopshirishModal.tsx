"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";

/**
 * KASSA TOPSHIRISH — kun yakunida xodim kassadagi naqdni SANAB kiritadi va
 * kunni direktorga yuboradi. Tizim hisobi ataylab KO'RSATILMAYDI: xodim
 * "qancha chiqishi kerak"ni ko'rsa, sanamasdan o'sha raqamni yozib qo'yishi
 * mumkin — nazorat ma'nosini yo'qotadi.
 */
export function TopshirishModal({
  sana,
  onClose,
  onDone,
}: {
  sana: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [sanalgan, setSanalgan] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const son = Number(sanalgan.replace(/[\s,]/g, ""));
  const sonTogri = sanalgan.trim() !== "" && Number.isInteger(son) && son >= 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!sonTogri) {
      setXato("Sanalgan naqd 0 yoki undan katta butun son bo'lishi kerak");
      return;
    }
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kunlik/topshirish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sana, sanalganNaqd: son }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Topshirib bo'lmadi");
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
    <Modal open onClose={onClose} title="Kassani direktorga topshirish">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">
          Kassadagi naqd pulni <span className="font-medium text-fg">sanab</span>, aniq summani
          kiriting. Direktor uni tizim hisobi bilan solishtiradi — farq bo&apos;lsa darhol
          ko&apos;rinadi.
        </p>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="topshirish-naqd">
            Kassadagi naqd (sanab chiqilgan, so&apos;m)
          </label>
          <input
            id="topshirish-naqd"
            value={sanalgan}
            onChange={(e) => setSanalgan(e.target.value)}
            required
            inputMode="numeric"
            placeholder="2 500 000"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg tnum"
          />
          {sonTogri && (
            <p className="text-2xs text-faint mt-1">
              Kiritilgan: <Money value={son} size="sm" tone="neutral" />
            </p>
          )}
        </div>

        <p className="text-2xs text-faint">
          Topshirilgandan keyin bu kunga yangi tushum kiritib bo&apos;lmaydi. Xato bo&apos;lsa
          direktor kunni qayta ochadi.
        </p>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            📤 Topshirish
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
