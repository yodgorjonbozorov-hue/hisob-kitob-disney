"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FarqBloki, SummaInput, sonOqi } from "./SummaInput";

/**
 * SMENANI YOPISH — solishtiruv varag'i (reconciliation sheet).
 *
 * "Yopish" tugmasi bosilishi bilan smena KO'R-KO'RONA yopilmaydi: avval shu
 * varaq ochiladi, tizim hisobi bilan real sanalgan pul yonma-yon turadi va
 * farq DARHOL hisoblanadi.
 *
 * Tizim hisobi faqat uni ko'rish huquqi borga (`kutilganNaqd !== null`)
 * ko'rsatiladi — xodimga esa yashiriladi, u avval sanaydi.
 *
 * "Kassada qoldirilgan" — qaytim uchun ataylab qoldirilgan pul. Odatda 0:
 * pul to'liq topshiriladi va keyingi smena 0 dan boshlanadi.
 */
export function SmenaYopishModal({
  raqam,
  kutilganNaqd,
  onClose,
  onDone,
}: {
  raqam: number;
  kutilganNaqd: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [sanalgan, setSanalgan] = useState("");
  const [qoldirilgan, setQoldirilgan] = useState("");
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const sanalganSon = sonOqi(sanalgan);
  const qoldirilganSon = qoldirilgan.trim() === "" ? 0 : sonOqi(qoldirilgan);
  const farq = kutilganNaqd === null || sanalganSon === null ? null : sanalganSon - kutilganNaqd;
  const izohKerak = farq !== null && farq !== 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sanalganSon === null) {
      setXato("Sanalgan naqd 0 yoki undan katta butun son bo'lishi kerak");
      return;
    }
    if (qoldirilganSon === null || qoldirilganSon > sanalganSon) {
      setXato("Kassada qoldirilgan pul sanalgan puldan ko'p bo'lmaydi");
      return;
    }
    if (izohKerak && !izoh.trim()) {
      setXato("Farq bor — sababini yozing");
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
          kiriting.
        </p>

        <SummaInput
          id="smena-sanalgan"
          label="Real kassada (sanab chiqilgan, so'm)"
          value={sanalgan}
          onChange={setSanalgan}
          autoFocus
        />

        <FarqBloki kutilgan={kutilganNaqd} real={sanalganSon} />

        <SummaInput
          id="smena-qoldirilgan"
          label="Kassada qoldirildi (qaytim uchun, so'm)"
          value={qoldirilgan}
          onChange={setQoldirilgan}
          yordam="Bo'sh qoldirilsa — 0. Ya'ni pul to'liq topshirildi va keyingi smena 0 dan boshlanadi."
        />

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="smena-izoh">
            Izoh {izohKerak ? <span className="text-expense">— majburiy</span> : "(ixtiyoriy)"}
          </label>
          <input
            id="smena-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={300}
            placeholder="Masalan: kam chiqqan pul sababi"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-surface-2 border border-line text-fg focus:border-brand focus:outline-none"
          />
        </div>

        <p className="text-2xs text-faint">
          Smena yopilgach raqamlari MUZLAYDI. Kunning jami kirim/chiqimiga ta&apos;sir
          qilmaydi. Xato bo&apos;lsa direktor smenani qayta ochadi.
        </p>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        {/* Klaviatura ochilganda tugma yo'qolib ketmasin — varaq ichida
            oxirgi blok bo'lib qoladi va Modal'ning o'z scroll'i uni
            ko'rinishda ushlab turadi. */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1 sticky bottom-0 bg-surface pb-1">
          <Button type="button" variant="secondary" onClick={onClose} className="sm:w-auto w-full">
            Bekor qilish
          </Button>
          <Button type="submit" loading={loading} className="w-full sm:w-auto">
            🔒 Smenani yopish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
