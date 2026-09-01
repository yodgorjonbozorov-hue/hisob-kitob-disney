"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { useToast } from "@/components/ui/Toast";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import type { XodimOylikHisobi } from "@/lib/kpi/oylik";
import { qisqaSumma } from "../kpiUi";

/**
 * OYNI YOPISH — tasdiqdan oldin hisobning to'liq ko'rinishi.
 *
 * Tasdiqlangach raqamlar snapshot bo'lib muzlatiladi: shundan keyin CRM
 * yoki zakaz o'zgarsa ham bu oyning oyligi jimgina siljib ketmaydi.
 */
export function OyYopishModal({
  hisob,
  oyNomi,
  onClose,
  onDone,
}: {
  hisob: XodimOylikHisobi;
  oyNomi: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [izoh, setIzoh] = useState("");
  const [yuborilmoqda, setYuborilmoqda] = useState(false);

  async function yubor() {
    setYuborilmoqda(true);
    try {
      const res = await fetch("/api/hr/kpi/oylik/yopish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: hisob.employeeId,
          oy: hisob.oy,
          izoh: izoh.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ message: data.error ?? "Xatolik yuz berdi", tone: "error" });
        return;
      }
      toast({ message: "Oy yopildi — hisob muzlatildi", tone: "success" });
      onDone();
    } catch {
      toast({ message: "Tarmoq xatosi — qayta urinib ko'ring", tone: "error" });
    } finally {
      setYuborilmoqda(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${oyNomi} — hisobni yakunlash`}>
      <div className="space-y-4">
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Sotuv</dt>
            <dd className="text-fg tnum">{qisqaSumma(hisob.sotuv)} so&apos;m</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Plan</dt>
            <dd className="text-fg tnum">
              {qisqaSumma(hisob.plan)} so&apos;m · {hisob.planFoizi}%
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Vazifa haqi</dt>
            <dd>
              <Money value={hisob.vazifaHaqi} size="sm" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Sotuv bonusi</dt>
            <dd>
              <Money value={hisob.sotuvBonusi} size="sm" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Plan bonusi</dt>
            <dd>
              <Money value={hisob.planBonusi} size="sm" />
            </dd>
          </div>
        </dl>

        <div className="border-t border-line pt-3">
          <p className="text-2xs text-muted uppercase tracking-wide">Jami</p>
          <Money value={hisob.jami} size="display" tone="brand" />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="yopish-izoh">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="yopish-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <p className="text-2xs text-faint">
          Yopilgandan keyin bu oyga ball yozib bo&apos;lmaydi va CRM o&apos;zgarsa ham hisob
          o&apos;zgarmaydi. Tuzatish kerak bo&apos;lsa alohida tuzatish qatori qo&apos;shiladi.
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={yuborilmoqda}>
            Bekor qilish
          </Button>
          <Button onClick={yubor} disabled={yuborilmoqda}>
            {yuborilmoqda ? "Yopilmoqda..." : "Hisobni tasdiqlash"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
