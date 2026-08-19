"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { soro } from "../soro";

interface Tarif {
  code: string;
  nomi: string;
}

const MAYDON =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

/**
 * TARIFNI O'ZGARTIRISH.
 *
 * Tanlov va tasdiq BITTA modalda: modal ichida modal ochilsa mobil ekranda
 * foydalanuvchi qayerdaligini yo'qotadi. Oqibatlar tanlovdan keyin darhol
 * ko'rinadi — "nima yopiladi?" degan savol tasdiqdan OLDIN javob topadi.
 */
export function TarifOzgartirish({
  tenantId,
  joriy,
  tariflar,
  ochiq,
  onYopish,
}: {
  tenantId: string;
  joriy: string;
  tariflar: Tarif[];
  ochiq: boolean;
  onYopish: () => void;
}) {
  const router = useRouter();
  const [yangi, setYangi] = useState(joriy);
  const [sabab, setSabab] = useState("");
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function yubor() {
    setBand(true);
    setXato(null);
    const javob = await soro(`/api/superadmin/tenants/${tenantId}/plan`, {
      body: { plan: yangi, sabab: sabab.trim() },
    });
    setBand(false);
    if (!javob.ok) {
      setXato(javob.xato);
      return;
    }
    setSabab("");
    onYopish();
    router.refresh();
  }

  return (
    <Modal open={ochiq} onClose={() => !band && onYopish()} title="Tarifni o'zgartirish">
      <div className="space-y-3">
        <div>
          <label htmlFor="tarif-tanlov" className="block text-sm font-medium text-fg mb-1">
            Yangi tarif
          </label>
          <select
            id="tarif-tanlov"
            className={MAYDON}
            value={yangi}
            onChange={(e) => setYangi(e.target.value)}
          >
            {tariflar.map((t) => (
              <option key={t.code} value={t.code}>
                {t.nomi}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg bg-surface-2 border border-line p-3 text-sm">
          <p className="text-2xs uppercase tracking-wide text-faint font-medium mb-1.5">
            Nima bo&apos;ladi
          </p>
          <ul className="space-y-1 text-fg">
            <li>
              · Tarif {joriy} → {yangi}
            </li>
            <li>· Yangi tarifda yo&apos;q modullar YOPILADI, lekin MA&apos;LUMOT O&apos;CHMAYDI.</li>
            <li>· Tarif qaytarilsa modullar va ma&apos;lumot aynan tiklanadi.</li>
          </ul>
        </div>

        <div>
          <label htmlFor="tarif-sabab" className="block text-sm font-medium text-fg mb-1">
            Sabab <span className="text-expense">*</span>
          </label>
          <textarea
            id="tarif-sabab"
            rows={2}
            minLength={10}
            value={sabab}
            onChange={(e) => setSabab(e.target.value)}
            className={MAYDON}
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
          <Button onClick={yubor} loading={band} disabled={sabab.trim().length < 10 || yangi === joriy}>
            O&apos;zgartirish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
