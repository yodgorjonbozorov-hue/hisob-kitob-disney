"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";

export interface QoidaDTO {
  id: string;
  turi: string;
  minDaqiqa: number;
  maxDaqiqa: number | null;
  summa: number;
  isActive: boolean;
}

export function QoidaModal({ qoida, onYopish }: { qoida: QoidaDTO | null; onYopish: () => void }) {
  const router = useRouter();
  const [turi, setTuri] = useState(qoida?.turi ?? "kechikish");
  const [minDaqiqa, setMinDaqiqa] = useState(qoida?.minDaqiqa ?? 6);
  const [maxDaqiqa, setMaxDaqiqa] = useState<string>(
    qoida?.maxDaqiqa != null ? String(qoida.maxDaqiqa) : ""
  );
  const [summa, setSumma] = useState(qoida?.summa ?? 0);
  const [faol, setFaol] = useState(qoida?.isActive ?? true);
  const [xato, setXato] = useState<string | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato(null);
    setYuklanmoqda(true);
    try {
      const body = qoida
        ? {
            minDaqiqa,
            maxDaqiqa: maxDaqiqa === "" ? null : parseInt(maxDaqiqa, 10),
            summa,
            isActive: faol,
          }
        : {
            turi,
            minDaqiqa: turi === "kelmadi" ? 0 : minDaqiqa,
            maxDaqiqa: turi === "kelmadi" || maxDaqiqa === "" ? null : parseInt(maxDaqiqa, 10),
            summa,
            isActive: faol,
          };
      const res = await fetch(
        qoida ? `/api/hr/jarima/qoidalar/${qoida.id}` : "/api/hr/jarima/qoidalar",
        {
          method: qoida ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
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

  const kechikishmi = (qoida?.turi ?? turi) === "kechikish";

  return (
    <Modal open onClose={onYopish} title={qoida ? "Qoidani tahrirlash" : "Yangi jarima qoidasi"}>
      <form onSubmit={saqla} className="space-y-4">
        {!qoida && (
          <div>
            <label className={LABEL_CLASS} htmlFor="qd-turi">Qoida turi</label>
            <select
              id="qd-turi"
              className={INPUT_CLASS}
              value={turi}
              onChange={(e) => setTuri(e.target.value)}
            >
              <option value="kechikish">Kechikish (daqiqa oralig'i)</option>
              <option value="kelmadi">Kelmagan kun</option>
            </select>
          </div>
        )}
        {kechikishmi && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS} htmlFor="qd-min">Daqiqa (dan)</label>
              <input
                id="qd-min"
                type="number"
                inputMode="numeric"
                min={0}
                max={1440}
                className={INPUT_CLASS}
                value={minDaqiqa}
                onChange={(e) => setMinDaqiqa(parseInt(e.target.value || "0", 10))}
                required
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="qd-max">Daqiqa (gacha, bo&apos;sh = ∞)</label>
              <input
                id="qd-max"
                type="number"
                inputMode="numeric"
                min={0}
                max={1440}
                className={INPUT_CLASS}
                value={maxDaqiqa}
                onChange={(e) => setMaxDaqiqa(e.target.value)}
                placeholder="∞"
              />
            </div>
          </div>
        )}
        <div>
          <label className={LABEL_CLASS} htmlFor="qd-summa">Jarima summasi (so&apos;m)</label>
          <input
            id="qd-summa"
            type="number"
            inputMode="numeric"
            min={0}
            className={INPUT_CLASS}
            value={summa || ""}
            onChange={(e) => setSumma(parseInt(e.target.value || "0", 10))}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-fg min-h-[44px]">
          <input
            type="checkbox"
            checked={faol}
            onChange={(e) => setFaol(e.target.checked)}
            className="w-4 h-4"
          />
          Faol
        </label>
        {xato && <p className="text-sm text-expense">{xato}</p>}
        <Button type="submit" className="w-full" loading={yuklanmoqda}>
          Saqlash
        </Button>
      </form>
    </Modal>
  );
}
