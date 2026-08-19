"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { soro } from "../soro";

/** Obuna muddatini to'lovsiz uzaytirish (bonus / kelishuv bo'yicha). */
export function MuddatUzaytirish({
  tenantId,
  ochiq,
  onYopish,
}: {
  tenantId: string;
  ochiq: boolean;
  onYopish: () => void;
}) {
  const router = useRouter();
  const [kunlar, setKunlar] = useState(30);
  const [sabab, setSabab] = useState("");
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function yubor() {
    setBand(true);
    setXato(null);
    const javob = await soro(`/api/superadmin/tenants/${tenantId}/extend`, {
      body: { kunlar: Number(kunlar), sabab: sabab.trim() || null },
    });
    setBand(false);
    if (!javob.ok) {
      setXato(javob.xato);
      return;
    }
    onYopish();
    router.refresh();
  }

  const maydon =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

  return (
    <Modal open={ochiq} onClose={() => !band && onYopish()} title="Muddatni uzaytirish">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          To&apos;lovsiz uzaytirish: obuna faol bo&apos;ladi va muddat shuncha kunga siljiydi.
        </p>
        <div>
          <label htmlFor="uzaytir-kun" className="block text-sm font-medium text-fg mb-1">
            Necha kun
          </label>
          <input
            id="uzaytir-kun"
            type="number"
            min={1}
            max={366}
            className={maydon}
            value={kunlar}
            onChange={(e) => setKunlar(Number(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor="uzaytir-sabab" className="block text-sm font-medium text-fg mb-1">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="uzaytir-sabab"
            className={maydon}
            value={sabab}
            onChange={(e) => setSabab(e.target.value)}
            placeholder="Masalan: shartnoma bo'yicha bonus"
          />
        </div>
        {xato && (
          <p className="text-sm text-expense-fg bg-expense-soft rounded-lg px-3 py-2" role="alert">
            {xato}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onYopish} disabled={band}>
            Bekor qilish
          </Button>
          <Button onClick={yubor} loading={band}>
            Uzaytirish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
