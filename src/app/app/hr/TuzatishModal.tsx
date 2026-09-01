"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";

/**
 * ADMIN TUZATISHI — istisno holatlar (telefon ishlamadi, lekin xodim ishda
 * edi). Sabab MAJBURIY: tuzatish auditda kim/qachon/nima sababdan ko'rinadi,
 * asl selfie/GPS dalillari o'chmaydi.
 */
export function TuzatishModal({
  ochiq,
  employeeId,
  ism,
  sana,
  onYopish,
}: {
  ochiq: boolean;
  employeeId: string;
  ism: string;
  sana: string;
  onYopish: () => void;
}) {
  const router = useRouter();
  const [kelgan, setKelgan] = useState("");
  const [ketgan, setKetgan] = useState("");
  const [holat, setHolat] = useState("");
  const [sabab, setSabab] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato(null);
    setYuklanmoqda(true);
    try {
      const res = await fetch("/api/hr/davomat/tuzatish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          sana,
          kelganVaqt: kelgan || null,
          ketganVaqt: ketgan || null,
          ...(holat ? { holat } : {}),
          sabab,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onYopish();
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setYuklanmoqda(false);
    }
  }

  return (
    <Modal open={ochiq} onClose={onYopish} title={`Tuzatish — ${ism} (${sana})`}>
      <form onSubmit={saqla} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="tz-kelgan">Kelish vaqti</label>
            <input
              id="tz-kelgan"
              type="time"
              className={INPUT_CLASS}
              value={kelgan}
              onChange={(e) => setKelgan(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="tz-ketgan">Ketish vaqti</label>
            <input
              id="tz-ketgan"
              type="time"
              className={INPUT_CLASS}
              value={ketgan}
              onChange={(e) => setKetgan(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="tz-holat">Holat (ixtiyoriy)</label>
          <Select
            id="tz-holat"
            value={holat}
            onChange={setHolat}
            options={[
              { value: "", label: "O'zgartirilmasin" },
              { value: "keldi", label: "Keldi" },
              { value: "yarim", label: "Yarim kun" },
              { value: "kelmadi", label: "Kelmadi" },
              { value: "tatil", label: "Ta'til / dam" },
            ]}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="tz-sabab">Sabab (majburiy)</label>
          <input
            id="tz-sabab"
            className={INPUT_CLASS}
            value={sabab}
            onChange={(e) => setSabab(e.target.value)}
            placeholder="Masalan: telefoni ishlamadi, o'zi ishda edi"
            required
            minLength={3}
            maxLength={300}
          />
        </div>
        {xato && <p className="text-sm text-expense">{xato}</p>}
        <Button type="submit" className="w-full" loading={yuklanmoqda}>
          Saqlash
        </Button>
      </form>
    </Modal>
  );
}
