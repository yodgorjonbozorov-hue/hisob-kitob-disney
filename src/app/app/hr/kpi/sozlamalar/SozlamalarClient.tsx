"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { KpiSozlamaDTO } from "@/lib/kpi/sozlama";
import type { VazifaDTO, PresetDTO } from "@/lib/kpi/vazifa";
import { BonusSozlama } from "./BonusSozlama";
import { VazifalarSozlama, type XodimQator } from "./VazifalarSozlama";

const TABLAR = ["vazifalar", "bonus"] as const;
type Tab = (typeof TABLAR)[number];

const TAB_NOMI: Record<Tab, string> = {
  vazifalar: "Vazifalar",
  bonus: "Oylik va bonus",
};

export function SozlamalarClient({
  sozlama,
  vazifalar,
  presetlar,
  xodimlar,
}: {
  sozlama: KpiSozlamaDTO;
  vazifalar: VazifaDTO[];
  presetlar: PresetDTO[];
  xodimlar: XodimQator[];
}) {
  const [tab, setTab] = useState<Tab>("vazifalar");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABLAR.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? "primary" : "secondary"}
            onClick={() => setTab(t)}
          >
            {TAB_NOMI[t]}
          </Button>
        ))}
      </div>

      {tab === "vazifalar" && (
        <VazifalarSozlama vazifalar={vazifalar} presetlar={presetlar} xodimlar={xodimlar} />
      )}
      {tab === "bonus" && <BonusSozlama boshlangich={sozlama} />}
    </div>
  );
}
