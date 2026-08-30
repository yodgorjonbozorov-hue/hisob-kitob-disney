"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import type { XodimOylikDTO } from "@/lib/queries/xodimPlan";

const HOLAT_NOMI: Record<string, string> = {
  qoralama: "Qoralama",
  tolangan: "To'langan",
};

/** OYLIK TAB — xodimning vedomost tarixi (hisoblash/to'lash — Oylik sahifasida). */
export function OylikTab({ oyliklar }: { oyliklar: XodimOylikDTO[] }) {
  if (oyliklar.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="💵"
          title="Hali vedomost yo'q"
          description="Oylik hisoblash va to'lash — Oylik sahifasida."
          action={
            <Link href="/app/hr/oylik" className="text-sm text-brand hover:underline">
              Oylik sahifasiga o&apos;tish
            </Link>
          }
        />
      </Card>
    );
  }
  return (
    <Card>
      <p className="font-bold text-fg mb-2">Oylik vedomost tarixi</p>
      <div className="space-y-2">
        {oyliklar.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between gap-2 border-b border-line last:border-0 pb-2 last:pb-0"
          >
            <div>
              <p className="text-sm text-fg tnum font-medium">{o.oy}</p>
              <p className="text-2xs text-muted tnum">
                Asos: {o.hisoblangan.toLocaleString("uz-UZ")}
                {o.avans > 0 && ` · Avans: ${o.avans.toLocaleString("uz-UZ")}`}
                {o.tolanganSana && ` · ${o.tolanganSana}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Money value={o.tolanadigan} size="sm" tone="neutral" />
              <Badge tone={o.holat === "tolangan" ? "kirim" : "neutral"}>
                {HOLAT_NOMI[o.holat] ?? o.holat}
              </Badge>
            </div>
          </div>
        ))}
      </div>
      <p className="text-2xs text-faint mt-3">
        Hisoblash, avans va to&apos;lash —{" "}
        <Link href="/app/hr/oylik" className="text-brand hover:underline">
          Oylik sahifasida
        </Link>
        .
      </p>
    </Card>
  );
}
