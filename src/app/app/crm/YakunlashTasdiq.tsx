"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { kirimUlushi, qarzUlushi, tolovHolati, TOLOV_HOLAT_NOMI } from "@/lib/crm/pipeline";
import type { BuyurtmaDTO } from "./turlar";

/**
 * ZAKAZNI YAKUNLASH TASDIG'I (4- va 5-talab).
 *
 * Pul yozadigan amal, shuning uchun brauzerning `confirm()` i emas: summa
 * QAYERGA tushishi — kirimga qancha, qarzdorlikka qancha — oldindan
 * ko'rsatiladi. Taqsimot brauzerda ham, serverda ham AYNI funksiyalardan
 * (`lib/crm/pipeline.ts`) chiqadi, ya'ni ko'rsatilgan raqam yozilgan raqam.
 */
export function YakunlashTasdiq({
  b,
  onClose,
  onDone,
}: {
  b: BuyurtmaDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const kirim = kirimUlushi(b.summa, b.tolangan);
  const qarz = qarzUlushi(b.summa, b.tolangan);
  const holat = tolovHolati(b.summa, b.tolangan);

  async function yakunlash() {
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holat: "YUTILDI" }),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Yakunlanmadi");
      return;
    }
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-line p-5 space-y-3"
      >
        <h3 className="font-semibold text-fg">Zakazni yutildi qilish</h3>
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{b.nomi}</span> —{" "}
          <span className="tnum">{formatMoney(b.summa)}</span> ({TOLOV_HOLAT_NOMI[holat].toLowerCase()})
        </p>

        <ul className="text-xs space-y-1 border-l-2 border-line pl-3">
          <li className={kirim > 0 ? "text-income font-medium" : "text-faint"}>
            Kirim: <span className="tnum">{formatMoney(kirim)}</span>
          </li>
          <li className={qarz > 0 ? "text-expense font-medium" : "text-faint"}>
            Qarzdorlik: <span className="tnum">{formatMoney(qarz)}</span>
          </li>
          <li className="text-muted">Kategoriya: {b.kategoriya ?? "Sotuv"}</li>
          <li className="text-muted">Sotuvchi: {b.masulIsm ?? "—"}</li>
          {b.sana && <li className="text-muted tnum">Zakaz sanasi: {b.sana}</li>}
        </ul>

        <p className="text-2xs text-faint">
          Kirim va qarz bir marta yoziladi — takroriy bosishda yangi yozuv yaratilmaydi.
        </p>
        {b.summa <= 0 && (
          <p className="text-2xs text-debt-fg">
            Narx kiritilmagan — zakaz yutildi bo&apos;ladi, lekin moliyaviy yozuv bo&apos;lmaydi.
          </p>
        )}
        {xato && <p className="text-expense text-sm">{xato}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-line text-sm text-muted">
            Bekor
          </button>
          <button
            onClick={yakunlash}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-income text-white text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Yozilmoqda..." : "Ha, yutildi"}
          </button>
        </div>
      </div>
    </div>
  );
}
