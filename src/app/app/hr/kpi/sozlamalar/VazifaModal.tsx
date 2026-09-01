"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import type { VazifaDTO } from "@/lib/kpi/vazifa";
import { songa } from "./sozlamaShakl";

/** VAZIFA YARATISH/TAHRIRLASH — nomi, izohi va oylik haqi. */
export function VazifaModal({
  vazifa,
  onClose,
  onDone,
}: {
  /** null — yangi vazifa. */
  vazifa: VazifaDTO | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [nomi, setNomi] = useState(vazifa?.nomi ?? "");
  const [izoh, setIzoh] = useState(vazifa?.izoh ?? "");
  const [oylikHaq, setOylikHaq] = useState(vazifa?.oylikHaq ?? 0);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  async function saqla() {
    if (!nomi.trim()) {
      toast({ message: "Vazifa nomi kiritilishi shart", tone: "error" });
      return;
    }
    setSaqlanmoqda(true);
    try {
      const res = await fetch(
        vazifa ? `/api/hr/kpi/vazifalar/${vazifa.id}` : "/api/hr/kpi/vazifalar",
        {
          method: vazifa ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nomi: nomi.trim(), izoh: izoh.trim() || null, oylikHaq }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast({ message: data.error ?? "Xatolik yuz berdi", tone: "error" });
        return;
      }
      toast({ message: vazifa ? "Vazifa yangilandi" : "Vazifa qo'shildi", tone: "success" });
      onDone();
    } catch {
      toast({ message: "Tarmoq xatosi — qayta urinib ko'ring", tone: "error" });
    } finally {
      setSaqlanmoqda(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={vazifa ? "Vazifani tahrirlash" : "Yangi vazifa"}>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="vazifa-nomi">
            Vazifa nomi
          </label>
          <input
            id="vazifa-nomi"
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            placeholder="Masalan: Mijoz bilan aloqa va qo'ng'iroqlar tahlili"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="vazifa-izoh">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="vazifa-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="vazifa-haq">
            Oylik haq (so&apos;m)
          </label>
          <input
            id="vazifa-haq"
            value={oylikHaq.toLocaleString("uz-UZ")}
            onChange={(e) => setOylikHaq(songa(e.target.value))}
            className={INPUT_CLASS}
            inputMode="numeric"
          />
          <p className="text-2xs text-faint mt-1">
            Vazifa to&apos;liq bajarilgandagi haq. Ball tushsa shu summadan foiz olinadi.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saqlanmoqda}>
            Bekor qilish
          </Button>
          <Button onClick={saqla} disabled={saqlanmoqda}>
            {saqlanmoqda ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
