"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { BuyurtmaKarta } from "./BuyurtmaKarta";
import { BuyurtmaModal } from "./BuyurtmaModal";
import { BuyurtmaSheet } from "./BuyurtmaSheet";
import { KirimTasdiq } from "./KirimTasdiq";
import type { BuyurtmaDTO, KategoriyaDTO, StageDTO, XodimDTO } from "./turlar";

const STAGE_RANG: Record<string, string> = {
  OPEN: "border-line",
  WON: "border-income/50",
  LOST: "border-expense/40",
};

/**
 * CRM kanban doskasi — kunlik buyurtmalar.
 * Yangi → Aloqa qilindi → Taklif yuborildi → Yutildi → Yo'qotildi.
 */
export function CrmClient({
  stages,
  buyurtmalar,
  kategoriyalar,
  xodimlar,
  meId,
  bugun,
}: {
  stages: StageDTO[];
  buyurtmalar: BuyurtmaDTO[];
  kategoriyalar: KategoriyaDTO[];
  xodimlar: XodimDTO[];
  meId: string;
  bugun: string;
}) {
  const router = useRouter();
  const [yangiOchiq, setYangiOchiq] = useState(false);
  const [tanlangan, setTanlangan] = useState<BuyurtmaDTO | null>(null);
  const [kirimTasdiq, setKirimTasdiq] = useState<BuyurtmaDTO | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  /**
   * Holatni o'zgartirish. "Yutildi" ga o'tkazishda kirim AVTOMATIK
   * yozilmaydi — tasdiq oynasi ochiladi (pul yozadigan amal hech qachon
   * sudrab tashlash bilan bo'lmasin).
   */
  async function kochirish(id: string, stage: StageDTO) {
    setXato(null);
    const b = buyurtmalar.find((x) => x.id === id);
    const res = await fetch(`/api/crm/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: stage.id }),
    });
    if (!res.ok) {
      setXato((await res.json()).error ?? "Xatolik yuz berdi");
      return;
    }
    setTanlangan(null);
    if (stage.turi === "WON" && b && b.summa > 0 && !b.transactionId) {
      setKirimTasdiq({ ...b, stageId: stage.id });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => setYangiOchiq(true)}
          className="bg-income text-white font-medium rounded-lg px-4 py-2 text-sm hover:brightness-110 transition"
        >
          + Yangi buyurtma
        </button>
        {xato && <p className="text-expense text-sm">{xato}</p>}
      </div>

      {/* Kanban — mobil/planshetda gorizontal siljiydi */}
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
        {stages.map((s) => {
          const ustun = buyurtmalar.filter((b) => b.stageId === s.id);
          const jami = ustun.reduce((a, b) => a + b.summa, 0);
          return (
            <div
              key={s.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId && kochirish(dragId, s)}
              className={`shrink-0 w-64 sm:w-72 bg-surface-2/60 rounded-2xl border ${
                STAGE_RANG[s.turi] ?? "border-line"
              } p-2.5`}
            >
              <div className="flex items-center justify-between px-1.5 pb-2">
                <p className="text-sm font-semibold text-fg">{s.nomi}</p>
                <p className="text-2xs text-faint tnum">
                  {ustun.length} ta{jami > 0 ? ` · ${formatMoney(jami)}` : ""}
                </p>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {ustun.map((b) => (
                  <BuyurtmaKarta
                    key={b.id}
                    b={b}
                    holat={s.nomi}
                    onClick={() => setTanlangan(b)}
                    onDragStart={() => setDragId(b.id)}
                    onDragEnd={() => setDragId(null)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {yangiOchiq && (
        <BuyurtmaModal
          kategoriyalar={kategoriyalar}
          stages={stages}
          xodimlar={xodimlar}
          meId={meId}
          bugun={bugun}
          onClose={() => setYangiOchiq(false)}
        />
      )}
      {tanlangan && (
        <BuyurtmaSheet
          b={tanlangan}
          stages={stages}
          onKochirish={(s) => kochirish(tanlangan.id, s)}
          onClose={() => setTanlangan(null)}
        />
      )}
      {kirimTasdiq && (
        <KirimTasdiq
          b={kirimTasdiq}
          onClose={() => {
            setKirimTasdiq(null);
            router.refresh();
          }}
          onDone={() => {
            setKirimTasdiq(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
