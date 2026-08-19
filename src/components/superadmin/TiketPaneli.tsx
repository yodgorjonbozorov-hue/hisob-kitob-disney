"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { soro } from "./soro";
import { HOLAT_LABEL, MUHIMLIK_LABEL } from "@/lib/superadmin/turlar";

const MAYDON =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

/**
 * Tiketga javob yozish va holatini o'zgartirish.
 *
 * "Ichki qayd" belgilangan xabar mijozga mo'ljallanmagan — u faqat
 * superadminlar ko'radigan ish yozuvi.
 */
export function TiketPaneli({
  ticketId,
  holat,
  muhimlik,
}: {
  ticketId: string;
  holat: string;
  muhimlik: string;
}) {
  const router = useRouter();
  const [matn, setMatn] = useState("");
  const [ichki, setIchki] = useState(false);
  const [yangiHolat, setYangiHolat] = useState(holat);
  const [yangiMuhimlik, setYangiMuhimlik] = useState(muhimlik);
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function yubor(e: FormEvent) {
    e.preventDefault();
    setBand(true);
    setXato(null);
    const javob = await soro(`/api/superadmin/support/${ticketId}`, {
      method: "PATCH",
      body: {
        holat: yangiHolat,
        muhimlik: yangiMuhimlik,
        ...(matn.trim() ? { xabar: matn.trim(), ichki } : {}),
      },
    });
    setBand(false);
    if (!javob.ok) {
      setXato(javob.xato);
      return;
    }
    setMatn("");
    router.refresh();
  }

  return (
    <form onSubmit={yubor} className="space-y-3">
      <div>
        <label htmlFor="tk-javob" className="block text-sm font-medium text-fg mb-1">
          Xabar
        </label>
        <textarea
          id="tk-javob"
          rows={3}
          className={MAYDON}
          value={matn}
          onChange={(e) => setMatn(e.target.value)}
          placeholder="Javob yoki ichki qayd..."
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" checked={ichki} onChange={(e) => setIchki(e.target.checked)} />
        Ichki qayd (mijozga mo&apos;ljallanmagan)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="tk-holat" className="block text-sm font-medium text-fg mb-1">
            Holat
          </label>
          <select
            id="tk-holat"
            className={MAYDON}
            value={yangiHolat}
            onChange={(e) => setYangiHolat(e.target.value)}
          >
            {Object.entries(HOLAT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tk-muh" className="block text-sm font-medium text-fg mb-1">
            Muhimlik
          </label>
          <select
            id="tk-muh"
            className={MAYDON}
            value={yangiMuhimlik}
            onChange={(e) => setYangiMuhimlik(e.target.value)}
          >
            {Object.entries(MUHIMLIK_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {xato && (
        <p className="text-sm text-expense-fg bg-expense-soft rounded-lg px-3 py-2" role="alert">
          {xato}
        </p>
      )}

      <Button type="submit" loading={band}>
        Saqlash
      </Button>
    </form>
  );
}
