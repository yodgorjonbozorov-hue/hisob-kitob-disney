"use client";

import { useState } from "react";

export interface ActivityDTO {
  id: string;
  turi: string;
  matn: string;
  createdAt: string;
}

/** Zakaz timeline'i va tez izoh formasi (CRM faoliyat lentasi). */
export function ZakazTarix({
  dealId,
  activities,
  onYangilandi,
}: {
  dealId: string;
  /** null — hali yuklanmoqda. */
  activities: ActivityDTO[] | null;
  onYangilandi: () => void;
}) {
  const [izoh, setIzoh] = useState("");

  async function izohYuborish(e: React.FormEvent) {
    e.preventDefault();
    if (!izoh.trim()) return;
    const res = await fetch(`/api/crm/deals/${dealId}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turi: "izoh", matn: izoh }),
    });
    if (res.ok) {
      setIzoh("");
      onYangilandi();
    }
  }

  return (
    <>
      <form onSubmit={izohYuborish} className="flex gap-2">
        <input
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          placeholder="Izoh yozing va Enter bosing..."
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button type="submit" className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium">
          +
        </button>
      </form>

      <div className="space-y-2">
        {activities === null ? (
          <p className="text-sm text-faint">Yuklanmoqda...</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-faint">Hali faoliyat yo&apos;q.</p>
        ) : (
          activities.map((a) => (
            <div key={a.id} className="text-sm border-l-2 border-line pl-3 py-0.5">
              <p className={a.turi === "tizim" ? "text-faint" : "text-fg"}>{a.matn}</p>
              <p className="text-2xs text-faint">{new Date(a.createdAt).toLocaleString("ru-RU")}</p>
            </div>
          ))
        )}
      </div>
    </>
  );
}
