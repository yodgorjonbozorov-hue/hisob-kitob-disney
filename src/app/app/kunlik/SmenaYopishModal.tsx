"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";

/**
 * SMENANI YOPISH — xodim smena oxirida kassadagi naqdni SANAB kiritadi.
 *
 * Tizim hisobi bu yerda ataylab KO'RSATILMAYDI (TopshirishModal bilan bir xil
 * qoida): xodim "qancha chiqishi kerak"ni ko'rsa, sanamasdan o'sha raqamni
 * yozib qo'yishi mumkin — nazorat ma'nosini yo'qotadi.
 *
 * "Kassada qoldirilgan" — qaytim uchun ataylab qoldirilgan pul. Odatda 0:
 * pul to'liq topshiriladi va keyingi smena 0 dan boshlanadi.
 */
export function SmenaYopishModal({
  raqam,
  onClose,
  onDone,
}: {
  raqam: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [sanalgan, setSanalgan] = useState("");
  const [qoldirilgan, setQoldirilgan] = useState("");
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const son = (v: string) => Number(v.replace(/[\s,]/g, ""));
  const sanalganSon = son(sanalgan);
  const qoldirilganSon = qoldirilgan.trim() === "" ? 0 : son(qoldirilgan);
  const sanalganTogri =
    sanalgan.trim() !== "" && Number.isInteger(sanalganSon) && sanalganSon >= 0;
  const qoldirilganTogri = Number.isInteger(qoldirilganSon) && qoldirilganSon >= 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!sanalganTogri) {
      setXato("Sanalgan naqd 0 yoki undan katta butun son bo'lishi kerak");
      return;
    }
    if (!qoldirilganTogri || qoldirilganSon > sanalganSon) {
      setXato("Kassada qoldirilgan pul sanalgan puldan ko'p bo'lmaydi");
      return;
    }
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kunlik/smena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sanalganNaqd: sanalganSon,
          qoldirilganNaqd: qoldirilganSon,
          izoh: izoh.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Smenani yopib bo'lmadi");
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
    <Modal open onClose={onClose} title={`${raqam}-smenani yopish`}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">
          Kassadagi naqd pulni <span className="font-medium text-fg">sanab</span>, aniq summani
          kiriting. Tizim shu smenaning hisobi bilan solishtiradi — farq bo&apos;lsa darhol
          ko&apos;rinadi.
        </p>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="smena-sanalgan">
            Kassadagi naqd (sanab chiqilgan, so&apos;m)
          </label>
          <input
            id="smena-sanalgan"
            value={sanalgan}
            onChange={(e) => setSanalgan(e.target.value)}
            required
            inputMode="numeric"
            placeholder="1 500 000"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg tnum"
          />
          {sanalganTogri && (
            <p className="text-2xs text-faint mt-1">
              Kiritilgan: <Money value={sanalganSon} size="sm" tone="neutral" />
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="smena-qoldirilgan">
            Kassada qoldirildi (qaytim uchun, so&apos;m)
          </label>
          <input
            id="smena-qoldirilgan"
            value={qoldirilgan}
            onChange={(e) => setQoldirilgan(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg tnum"
          />
          <p className="text-2xs text-faint mt-1">
            Bo&apos;sh qoldirilsa — 0. Ya&apos;ni pul to&apos;liq topshirildi va keyingi smena
            <span className="text-fg"> 0 dan</span> boshlanadi.
          </p>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="smena-izoh">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="smena-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={300}
            placeholder="Masalan: kam chiqqan pul sababi"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg"
          />
        </div>

        <p className="text-2xs text-faint">
          Smena yopilgach raqamlari MUZLAYDI. Kunning jami kirim/chiqimiga ta&apos;sir
          qilmaydi. Xato bo&apos;lsa direktor smenani qayta ochadi.
        </p>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            🔒 Smenani yopish
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
