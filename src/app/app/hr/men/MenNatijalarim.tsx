"use client";

import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import type { XodimPerformanceDTO } from "@/lib/queries/xodimPlan";
import type { XodimVazifaDTO } from "@/lib/services/xodimVazifa";
import { PlanProgress } from "../PlanProgress";
import { VazifalarTab } from "../xodim/[id]/VazifalarTab";

/**
 * MENING NATIJALARIM — xodimning o'z plani, natijasi va vazifalari
 * ("Davomatim" sahifasining davomi). FAQAT o'z ma'lumoti: employee serverda
 * `userId` orqali topiladi, boshqa xodimlarning oyligi/statistikasi bu yerga
 * umuman kelmaydi.
 */
export function MenNatijalarim({
  oy,
  performance,
  vazifalar,
}: {
  oy: string;
  performance: XodimPerformanceDTO;
  vazifalar: XodimVazifaDTO[];
}) {
  const p = performance;
  return (
    <div className="space-y-4">
      <Card>
        <p className="font-bold text-fg mb-2">Mening planim ({oy})</p>
        {p.plan ? (
          <PlanProgress plan={p.plan} />
        ) : (
          <p className="text-sm text-muted">Bu oy uchun plan belgilanmagan.</p>
        )}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <p className="text-2xs text-muted">Zakazlar</p>
            <p className="text-lg font-bold text-fg tnum">{p.zakazlar}</p>
          </div>
          <div>
            <p className="text-2xs text-muted">Savdo</p>
            <Money value={p.savdo} size="sm" tone="income" />
          </div>
          <div>
            <p className="text-2xs text-muted">Vazifalar</p>
            <p className="text-lg font-bold text-fg tnum">
              {p.vazifa.bajarildi}/{p.vazifa.jami}
            </p>
          </div>
        </div>
      </Card>

      <div>
        <p className="font-bold text-fg mb-2">Mening vazifalarim</p>
        <VazifalarTab employeeId={p.id} ism={p.ism} vazifalar={vazifalar} boshqaruvchi={false} />
      </div>
    </div>
  );
}
