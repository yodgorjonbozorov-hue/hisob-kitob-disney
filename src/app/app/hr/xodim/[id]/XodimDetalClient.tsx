"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { shiftMonthString } from "@/lib/date";
import type { TarixYozuvDTO, JarimaDTO, BonusDTO } from "@/lib/queries/davomat";
import type {
  XodimPerformanceDTO,
  PlanDTO,
  XodimZakazDTO,
  XodimOylikDTO,
} from "@/lib/queries/xodimPlan";
import type { XodimVazifaDTO } from "@/lib/services/xodimVazifa";
import { XodimAvatar } from "../../XodimAvatar";
import { PlanProgress } from "../../PlanProgress";
import { PlanModal } from "../../PlanModal";
import type { XodimSiyosatDTO } from "./SiyosatKarta";
import { UmumiyTab } from "./UmumiyTab";
import { ZakazlarTab } from "./ZakazlarTab";
import { VazifalarTab } from "./VazifalarTab";
import { DavomatTab } from "./DavomatTab";
import { OylikTab } from "./OylikTab";

const TABLAR = ["umumiy", "zakazlar", "vazifalar", "davomat", "oylik"] as const;
type Tab = (typeof TABLAR)[number];

const TAB_NOMI: Record<Tab, string> = {
  umumiy: "Umumiy",
  zakazlar: "Zakazlar",
  vazifalar: "Vazifalar",
  davomat: "Davomat",
  oylik: "Oylik",
};

export type XodimBosh = XodimSiyosatDTO & {
  ism: string;
  lavozim: string | null;
  tel: string | null;
  rasmUrl: string | null;
  isActive: boolean;
  userId: string | null;
};

export function XodimDetalClient({
  xodim,
  oy,
  bugun,
  performance,
  planTarixi,
  vazifalar,
  oyliklar,
  zakazlar,
  tarix,
  jarimalar,
  bonuslar,
  jadvallar,
  joylar,
}: {
  xodim: XodimBosh;
  oy: string;
  bugun: string;
  performance: XodimPerformanceDTO | null;
  planTarixi: PlanDTO[];
  vazifalar: XodimVazifaDTO[];
  oyliklar: XodimOylikDTO[];
  zakazlar: XodimZakazDTO[];
  tarix: TarixYozuvDTO[];
  jarimalar: JarimaDTO[];
  bonuslar: BonusDTO[];
  jadvallar: { id: string; nomi: string; standart: boolean }[];
  joylar: { id: string; nomi: string; standart: boolean }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("umumiy");
  const [planModal, setPlanModal] = useState(false);

  const holat = performance?.holat ?? (xodim.isActive ? "faol" : "ketgan");
  const holatBelgi =
    holat === "ketgan"
      ? { matn: "Ishdan chiqqan", tone: "neutral" as const }
      : holat === "tatil"
        ? { matn: "Ta'tilda", tone: "warning" as const }
        : { matn: "Faol", tone: "kirim" as const };

  function oyniOzgart(delta: number) {
    router.push(`/app/hr/xodim/${xodim.id}?oy=${shiftMonthString(oy, delta)}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <XodimAvatar ism={xodim.ism} rasmUrl={xodim.rasmUrl} size="lg" />
          <div>
            <p className="text-2xs text-muted">
              <Link href="/app/hr" className="hover:text-fg">
                Xodimlar
              </Link>{" "}
              / {xodim.ism}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2">
              {xodim.ism} <Badge tone={holatBelgi.tone}>{holatBelgi.matn}</Badge>
            </h1>
            <p className="text-sm text-muted mt-0.5">
              {xodim.lavozim ?? "—"}
              {xodim.tel && ` · ${xodim.tel}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => oyniOzgart(-1)}>
            ←
          </Button>
          <span className="text-sm text-fg tnum">{oy}</span>
          <Button size="sm" variant="ghost" onClick={() => oyniOzgart(1)}>
            →
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        {performance?.plan ? (
          <PlanProgress plan={performance.plan} />
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted">Bu oy uchun plan belgilanmagan.</p>
            <Button size="sm" variant="secondary" onClick={() => setPlanModal(true)}>
              Plan belgilash
            </Button>
          </div>
        )}
        {performance?.plan && (
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => setPlanModal(true)}
              className="text-2xs text-brand hover:underline"
            >
              Planni o&apos;zgartirish
            </button>
          </div>
        )}
      </div>

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

      {tab === "umumiy" && (
        <UmumiyTab performance={performance} planTarixi={planTarixi} vazifalar={vazifalar} />
      )}
      {tab === "zakazlar" && <ZakazlarTab zakazlar={zakazlar} userIdBor={Boolean(xodim.userId)} />}
      {tab === "vazifalar" && (
        <VazifalarTab employeeId={xodim.id} ism={xodim.ism} vazifalar={vazifalar} boshqaruvchi />
      )}
      {tab === "davomat" && (
        <DavomatTab
          xodim={xodim}
          bugun={bugun}
          tarix={tarix}
          jarimalar={jarimalar}
          bonuslar={bonuslar}
          jadvallar={jadvallar}
          joylar={joylar}
        />
      )}
      {tab === "oylik" && <OylikTab oyliklar={oyliklar} />}

      {planModal && (
        <PlanModal
          employeeId={xodim.id}
          ism={xodim.ism}
          oy={oy}
          plan={performance?.plan ?? null}
          userIdBor={Boolean(xodim.userId)}
          onClose={() => setPlanModal(false)}
          onDone={() => {
            setPlanModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
