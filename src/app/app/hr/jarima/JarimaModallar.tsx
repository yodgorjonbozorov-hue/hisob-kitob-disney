"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import type { JarimaDTO } from "@/lib/queries/davomat";

function XodimTanlash({
  xodimlar,
  value,
  onChange,
}: {
  xodimlar: { id: string; ism: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className={LABEL_CLASS} htmlFor="xodim-tanlash">Xodim</label>
      <Select
        id="xodim-tanlash"
        value={value}
        onChange={onChange}
        placeholder="Tanlang..."
        searchable={xodimlar.length > 7}
        options={xodimlar.map((x) => ({ value: x.id, label: x.ism }))}
      />
    </div>
  );
}

/** Jarima bo'yicha qaror: tasdiqlash (summani tahrirlab) yoki bekor qilish. */
export function QarorModal({ jarima, onYopish }: { jarima: JarimaDTO; onYopish: () => void }) {
  const [summa, setSumma] = useState(jarima.summa);
  const [izoh, setIzoh] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [amal, setAmal] = useState<"tasdiqlash" | "rad" | null>(null);

  async function yubor(qaror: "tasdiqlash" | "rad") {
    setAmal(qaror);
    setXato(null);
    try {
      const res = await fetch(`/api/hr/jarima/${jarima.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amal: qaror, summa, izoh: izoh || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onYopish();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setAmal(null);
    }
  }

  return (
    <Modal open onClose={onYopish} title={`Jarima — ${jarima.ism}`}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {jarima.sana} · {jarima.sabab}
          {jarima.kechikishDaqiqa != null && ` (${jarima.kechikishDaqiqa} daqiqa kechikish)`}
        </p>
        <div>
          <label className={LABEL_CLASS} htmlFor="q-summa">Summa (so&apos;m)</label>
          <input
            id="q-summa"
            type="number"
            inputMode="numeric"
            min={0}
            className={INPUT_CLASS}
            value={summa}
            onChange={(e) => setSumma(parseInt(e.target.value || "0", 10))}
          />
          {summa !== jarima.aslSumma && (
            <p className="text-2xs text-muted mt-1">
              Asl summa: {jarima.aslSumma.toLocaleString("uz-UZ")} so&apos;m — o&apos;zgarish auditda qoladi
            </p>
          )}
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="q-izoh">Izoh (ixtiyoriy)</label>
          <input
            id="q-izoh"
            className={INPUT_CLASS}
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={300}
          />
        </div>
        {xato && <p className="text-sm text-expense">{xato}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" loading={amal === "rad"} onClick={() => void yubor("rad")}>
            Bekor qilish
          </Button>
          <Button loading={amal === "tasdiqlash"} onClick={() => void yubor("tasdiqlash")}>
            Tasdiqlash
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Qo'lda jarima — u ham avval KUTILMOQDA holatida ochiladi. */
export function QoldaJarimaModal({
  xodimlar,
  onYopish,
}: {
  xodimlar: { id: string; ism: string }[];
  onYopish: () => void;
}) {
  return (
    <SummaFormModal
      sarlavha="Qo'lda jarima"
      endpoint="/api/hr/jarima"
      tugma="Jarima ochish"
      xodimlar={xodimlar}
      onYopish={onYopish}
    />
  );
}

/** Bonus berish. */
export function BonusModal({
  xodimlar,
  onYopish,
}: {
  xodimlar: { id: string; ism: string }[];
  onYopish: () => void;
}) {
  return (
    <SummaFormModal
      sarlavha="Bonus berish"
      endpoint="/api/hr/bonus"
      tugma="Bonus berish"
      xodimlar={xodimlar}
      onYopish={onYopish}
    />
  );
}

function SummaFormModal({
  sarlavha,
  endpoint,
  tugma,
  xodimlar,
  onYopish,
}: {
  sarlavha: string;
  endpoint: string;
  tugma: string;
  xodimlar: { id: string; ism: string }[];
  onYopish: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [sana, setSana] = useState(new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10));
  const [summa, setSumma] = useState(0);
  const [sabab, setSabab] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato(null);
    setYuklanmoqda(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, sana, summa, sabab }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onYopish();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setYuklanmoqda(false);
    }
  }

  return (
    <Modal open onClose={onYopish} title={sarlavha}>
      <form onSubmit={saqla} className="space-y-4">
        <XodimTanlash xodimlar={xodimlar} value={employeeId} onChange={setEmployeeId} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="sf-sana">Sana</label>
            <input
              id="sf-sana"
              type="date"
              className={INPUT_CLASS}
              value={sana}
              onChange={(e) => setSana(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="sf-summa">Summa (so&apos;m)</label>
            <input
              id="sf-summa"
              type="number"
              inputMode="numeric"
              min={1}
              className={INPUT_CLASS}
              value={summa || ""}
              onChange={(e) => setSumma(parseInt(e.target.value || "0", 10))}
              required
            />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="sf-sabab">Sabab</label>
          <input
            id="sf-sabab"
            className={INPUT_CLASS}
            value={sabab}
            onChange={(e) => setSabab(e.target.value)}
            placeholder='Masalan: "Avgust savdo natijasi"'
            required
            maxLength={300}
          />
        </div>
        {xato && <p className="text-sm text-expense">{xato}</p>}
        <Button type="submit" className="w-full" loading={yuklanmoqda}>
          {tugma}
        </Button>
      </form>
    </Modal>
  );
}
