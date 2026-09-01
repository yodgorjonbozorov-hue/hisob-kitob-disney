"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { LABEL_CLASS } from "@/components/ui/fieldStyles";

export interface XodimSiyosatDTO {
  id: string;
  workScheduleId: string | null;
  workLocationId: string | null;
  selfieTalab: boolean;
  gpsTalab: boolean;
  radiusTalab: boolean;
}

/**
 * DAVOMAT SIYOSATI — har xodimga alohida: jadval, ish joyi va talablar.
 * Masalan dala xodimiga radius o'chiriladi, ishonchli masofaviy xodimga
 * GPS ham o'chirilishi mumkin.
 */
export function SiyosatKarta({
  xodim,
  jadvallar,
  joylar,
}: {
  xodim: XodimSiyosatDTO;
  jadvallar: { id: string; nomi: string; standart: boolean }[];
  joylar: { id: string; nomi: string; standart: boolean }[];
}) {
  const router = useRouter();
  const [workScheduleId, setWorkScheduleId] = useState(xodim.workScheduleId ?? "");
  const [workLocationId, setWorkLocationId] = useState(xodim.workLocationId ?? "");
  const [selfieTalab, setSelfieTalab] = useState(xodim.selfieTalab);
  const [gpsTalab, setGpsTalab] = useState(xodim.gpsTalab);
  const [radiusTalab, setRadiusTalab] = useState(xodim.radiusTalab);
  const [xato, setXato] = useState<string | null>(null);
  const [saqlandi, setSaqlandi] = useState(false);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  async function saqla() {
    setXato(null);
    setSaqlandi(false);
    setYuklanmoqda(true);
    try {
      const res = await fetch(`/api/hr/xodimlar/${xodim.id}/siyosat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workScheduleId: workScheduleId || null,
          workLocationId: workLocationId || null,
          selfieTalab,
          gpsTalab,
          radiusTalab,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setSaqlandi(true);
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setYuklanmoqda(false);
    }
  }

  const standartJadval = jadvallar.find((j) => j.standart)?.nomi;
  const standartJoy = joylar.find((j) => j.standart)?.nomi;

  return (
    <Card>
      <p className="font-bold text-fg mb-3">Davomat siyosati</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="sk-jadval">Ish jadvali</label>
          <Select
            id="sk-jadval"
            value={workScheduleId}
            onChange={setWorkScheduleId}
            searchable={jadvallar.length > 7}
            options={[
              {
                value: "",
                label: standartJadval ? `Standart (${standartJadval})` : "Standart jadval yo'q",
              },
              ...jadvallar.map((j) => ({ value: j.id, label: j.nomi })),
            ]}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="sk-joy">Ish joyi (GPS)</label>
          <Select
            id="sk-joy"
            value={workLocationId}
            onChange={setWorkLocationId}
            searchable={joylar.length > 7}
            options={[
              {
                value: "",
                label: standartJoy ? `Standart (${standartJoy})` : "Standart ish joyi yo'q",
              },
              ...joylar.map((j) => ({ value: j.id, label: j.nomi })),
            ]}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-fg min-h-[44px]">
          <input
            type="checkbox"
            checked={selfieTalab}
            onChange={(e) => setSelfieTalab(e.target.checked)}
            className="w-4 h-4"
          />
          Selfie talab qilinadi
        </label>
        <label className="flex items-center gap-2 text-sm text-fg min-h-[44px]">
          <input
            type="checkbox"
            checked={gpsTalab}
            onChange={(e) => setGpsTalab(e.target.checked)}
            className="w-4 h-4"
          />
          GPS talab qilinadi
        </label>
        <label className="flex items-center gap-2 text-sm text-fg min-h-[44px]">
          <input
            type="checkbox"
            checked={radiusTalab}
            onChange={(e) => setRadiusTalab(e.target.checked)}
            className="w-4 h-4"
            disabled={!gpsTalab}
          />
          Ish joyi radiusi tekshiriladi
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" loading={yuklanmoqda} onClick={() => void saqla()}>
          Siyosatni saqlash
        </Button>
        {saqlandi && <span className="text-2xs text-income">Saqlandi ✓</span>}
        {xato && <span className="text-2xs text-expense">{xato}</span>}
      </div>
    </Card>
  );
}
