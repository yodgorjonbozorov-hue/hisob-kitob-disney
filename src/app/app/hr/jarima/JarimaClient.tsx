"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/EmptyState";
import type { JarimaDTO, BonusDTO } from "@/lib/queries/davomat";
import { JARIMA_HOLAT_NOMI, type JarimaHolat } from "@/lib/validation/davomat";
import { QarorModal, QoldaJarimaModal, BonusModal } from "./JarimaModallar";

type Tab = "kutilmoqda" | "tarix" | "bonus";

const HOLAT_TONE: Record<string, "warning" | "kirim" | "chiqim" | "neutral"> = {
  kutilmoqda: "warning",
  tasdiqlandi: "chiqim",
  rad: "neutral",
};

export function JarimaClient({
  jarimalar,
  bonuslar,
  xodimlar,
}: {
  jarimalar: JarimaDTO[];
  bonuslar: BonusDTO[];
  xodimlar: { id: string; ism: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("kutilmoqda");
  const [qaror, setQaror] = useState<JarimaDTO | null>(null);
  const [qoldaModal, setQoldaModal] = useState(false);
  const [bonusModal, setBonusModal] = useState(false);

  const kutilmoqda = jarimalar.filter((j) => j.holat === "kutilmoqda");
  const tarix = jarimalar.filter((j) => j.holat !== "kutilmoqda");

  function JarimaQator({ j, amal }: { j: JarimaDTO; amal?: boolean }) {
    return (
      <div className="flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-0">
        <div className="min-w-0">
          <p className="font-medium text-fg truncate">{j.ism}</p>
          <p className="text-2xs text-muted">
            {j.sana} · {j.sabab}
            {j.manba === "qolda" && " · qo'lda"}
            {j.summa !== j.aslSumma && ` · asl: ${j.aslSumma.toLocaleString("uz-UZ")}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Money value={j.summa} size="sm" tone="expense" />
          {amal ? (
            <Button size="sm" onClick={() => setQaror(j)}>
              Ko&apos;rish
            </Button>
          ) : (
            <Badge tone={HOLAT_TONE[j.holat] ?? "neutral"}>
              {JARIMA_HOLAT_NOMI[j.holat as JarimaHolat] ?? j.holat}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<Tab>
          options={[
            { value: "kutilmoqda", label: `Tasdiqlash (${kutilmoqda.length})` },
            { value: "tarix", label: "Tarix" },
            { value: "bonus", label: `Bonuslar (${bonuslar.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setQoldaModal(true)}>
            + Jarima
          </Button>
          <Button size="sm" onClick={() => setBonusModal(true)}>
            + Bonus
          </Button>
        </div>
      </div>

      <Card>
        {tab === "kutilmoqda" &&
          (kutilmoqda.length === 0 ? (
            <EmptyState title="Tasdiqlash kutilayotgan jarima yo'q" />
          ) : (
            <div>
              <p className="text-sm text-muted mb-2">
                Tasdiqlash kutilmoqda — faqat tasdiqlangan jarima oylikdan ushlanadi.
              </p>
              {kutilmoqda.map((j) => (
                <JarimaQator key={j.id} j={j} amal />
              ))}
            </div>
          ))}
        {tab === "tarix" &&
          (tarix.length === 0 ? (
            <EmptyState title="Jarima tarixi bo'sh" />
          ) : (
            tarix.map((j) => <JarimaQator key={j.id} j={j} />)
          ))}
        {tab === "bonus" &&
          (bonuslar.length === 0 ? (
            <EmptyState
              title="Hali bonus yo'q"
              action={<Button onClick={() => setBonusModal(true)}>Bonus berish</Button>}
            />
          ) : (
            bonuslar.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-fg truncate">{b.ism}</p>
                  <p className="text-2xs text-muted">
                    {b.sana} · {b.sabab}
                  </p>
                </div>
                <Money value={b.summa} size="sm" tone="income" />
              </div>
            ))
          ))}
      </Card>

      {qaror && (
        <QarorModal
          jarima={qaror}
          onYopish={() => {
            setQaror(null);
            router.refresh();
          }}
        />
      )}
      {qoldaModal && (
        <QoldaJarimaModal
          xodimlar={xodimlar}
          onYopish={() => {
            setQoldaModal(false);
            router.refresh();
          }}
        />
      )}
      {bonusModal && (
        <BonusModal
          xodimlar={xodimlar}
          onYopish={() => {
            setBonusModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
