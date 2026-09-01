"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import type { PresetDTO } from "@/lib/kpi/vazifa";
import type { VazifaHisobi } from "@/lib/kpi/oylik";

/**
 * BALL AYIRISH OYNASI — "qaysi vazifa bajarilmadi?".
 *
 * Tayyor sabab (preset) tanlansa ball ham, kritiklik ham SERVERDA
 * presetdan o'qiladi — bu yerdagi ko'rsatkich faqat ma'lumot uchun.
 * Qo'lda kiritish ham mumkin (sabab + ball + izoh).
 */
export function BallModal({
  employeeId,
  vazifa,
  presetlar,
  kunlikLimit,
  bugun,
  onClose,
  onDone,
}: {
  employeeId: string;
  vazifa: VazifaHisobi;
  presetlar: PresetDTO[];
  kunlikLimit: number;
  bugun: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [presetId, setPresetId] = useState<string | null>(null);
  const [sabab, setSabab] = useState("");
  const [ball, setBall] = useState(1);
  const [sana, setSana] = useState(bugun);
  const [izoh, setIzoh] = useState("");
  const [yuborilmoqda, setYuborilmoqda] = useState(false);

  // Shu vazifaga tegishli + global (vazifasiz) sabablar.
  const mos = presetlar.filter((p) => p.taskId === vazifa.taskId || p.taskId === null);

  async function yubor() {
    if (!presetId && !sabab.trim()) {
      toast({ message: "Sabab tanlang yoki yozing", tone: "error" });
      return;
    }
    setYuborilmoqda(true);
    try {
      const res = await fetch("/api/hr/kpi/ball", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          taskId: vazifa.taskId,
          sana,
          ball: presetId ? 1 : ball,
          sabab: presetId ? "preset" : sabab.trim(),
          izoh: izoh.trim() || null,
          presetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ message: data.error ?? "Xatolik yuz berdi", tone: "error" });
        return;
      }
      toast({
        message: `Ball ayrildi: ${data.ballOldin} → ${data.ballKeyin}`,
        tone: "success",
      });
      onDone();
    } catch {
      toast({ message: "Tarmoq xatosi — qayta urinib ko'ring", tone: "error" });
    } finally {
      setYuborilmoqda(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Qaysi vazifa bajarilmadi?">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-2xs text-muted">Vazifa</p>
          <p className="text-sm font-medium text-fg">{vazifa.nomi}</p>
          <p className="text-2xs text-faint mt-1 tnum">Joriy ball: {vazifa.ball}</p>
        </div>

        {mos.length > 0 && (
          <div>
            <p className={LABEL_CLASS}>Tayyor sabablar</p>
            <div className="space-y-1.5">
              {mos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(presetId === p.id ? null : p.id)}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition ${
                    presetId === p.id
                      ? "border-brand bg-brand-wash"
                      : "border-line hover:bg-surface-2"
                  }`}
                >
                  <span className="min-w-0 flex-1 text-sm text-fg">
                    {p.sabab}
                    {p.kritik && (
                      <span className="ml-2 inline-block align-middle">
                        <Badge tone="chiqim">Ishonch</Badge>
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-bold tnum text-expense">−{p.ball}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!presetId && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS} htmlFor="kpi-sabab">
                Boshqa sabab
              </label>
              <input
                id="kpi-sabab"
                value={sabab}
                onChange={(e) => setSabab(e.target.value)}
                placeholder="Nima bajarilmadi"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="kpi-ball">
                Ball
              </label>
              <input
                id="kpi-ball"
                type="number"
                min={1}
                max={100}
                value={ball}
                onChange={(e) => setBall(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-sana">
              Sana
            </label>
            <input
              id="kpi-sana"
              type="date"
              value={sana}
              onChange={(e) => setSana(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-izoh">
              Izoh (ixtiyoriy)
            </label>
            <input
              id="kpi-izoh"
              value={izoh}
              onChange={(e) => setIzoh(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <p className="text-2xs text-faint">
          Oddiy jarimalarda bir vazifa uchun kuniga ko&apos;pi bilan {kunlikLimit} ball tushadi.
          Ishonch buzilishi (yolg&apos;on ma&apos;lumot va sh.k.) bu limitga kirmaydi.
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={yuborilmoqda}>
            Bekor qilish
          </Button>
          <Button onClick={yubor} disabled={yuborilmoqda}>
            {yuborilmoqda ? "Saqlanmoqda..." : "Ball ayirish"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
