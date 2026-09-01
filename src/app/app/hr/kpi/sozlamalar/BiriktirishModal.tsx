"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { XodimAvatar } from "../../XodimAvatar";
import type { VazifaDTO } from "@/lib/kpi/vazifa";

export interface BiriktirishXodimi {
  id: string;
  ism: string;
  lavozim: string | null;
  rasmUrl: string | null;
  biriktirilgan: boolean;
}

/**
 * VAZIFANI XODIMLARGA BIRIKTIRISH.
 *
 * Olib tashlash yozuvni o'chirmaydi — biriktiruv nofaol bo'ladi, shuning
 * uchun o'tgan oylardagi ball tarixi va oylik hisobi havolasiz qolmaydi.
 */
export function BiriktirishModal({
  vazifa,
  xodimlar,
  onClose,
  onDone,
}: {
  vazifa: VazifaDTO;
  xodimlar: BiriktirishXodimi[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [holat, setHolat] = useState<Record<string, boolean>>(
    Object.fromEntries(xodimlar.map((x) => [x.id, x.biriktirilgan]))
  );
  const [ishlamoqda, setIshlamoqda] = useState<string | null>(null);

  async function almashtir(employeeId: string) {
    const yangi = !holat[employeeId];
    setIshlamoqda(employeeId);
    try {
      const res = await fetch(`/api/hr/kpi/vazifalar/${vazifa.id}/biriktirish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, aktiv: yangi }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ message: data.error ?? "Xatolik yuz berdi", tone: "error" });
        return;
      }
      setHolat((p) => ({ ...p, [employeeId]: yangi }));
    } catch {
      toast({ message: "Tarmoq xatosi — qayta urinib ko'ring", tone: "error" });
    } finally {
      setIshlamoqda(null);
    }
  }

  return (
    <Modal open onClose={onClose} title={vazifa.nomi} size="lg">
      <div className="space-y-3">
        <p className="text-2xs text-muted">
          Vazifa biriktirilgan xodimda har oy {"—"} boshlang&apos;ich balldan boshlab {"—"}
          alohida ball yuritiladi.
        </p>

        <ul className="space-y-1.5 max-h-96 overflow-y-auto">
          {xodimlar.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => almashtir(x.id)}
                disabled={ishlamoqda === x.id}
                className={`w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition disabled:opacity-50 ${
                  holat[x.id] ? "border-brand bg-brand-wash" : "border-line hover:bg-surface-2"
                }`}
              >
                <XodimAvatar ism={x.ism} rasmUrl={x.rasmUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg truncate">{x.ism}</span>
                  <span className="block text-2xs text-muted truncate">{x.lavozim ?? "—"}</span>
                </span>
                <span className="shrink-0 text-2xs text-brand">
                  {holat[x.id] ? "Biriktirilgan" : "Biriktirish"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex justify-end">
          <Button onClick={onDone}>Yopish</Button>
        </div>
      </div>
    </Modal>
  );
}
