"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import type { KunlikTarixDTO } from "@/lib/queries/kunlik";
import { sanaUz } from "../vaqt";

export function TarixClient({ tarix }: { tarix: KunlikTarixDTO[] }) {
  return (
    <Card>
      {tarix.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Hali kunlik hisobot yo'q"
          description="Birinchi tushum kiritilgach shu yerda kunlar ro'yxati paydo bo'ladi."
        />
      ) : (
        <ul className="divide-y divide-line">
          {tarix.map((r) => (
            <li key={r.id}>
              <Link
                href={`/app/kunlik?sana=${r.sana}`}
                className="py-3 flex items-center justify-between gap-3 hover:bg-surface-2 rounded-lg px-2 -mx-2 transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{sanaUz(r.sana)}</p>
                  <p className="text-2xs text-faint">
                    {r.holat === "CONFIRMED"
                      ? `🟢 Tasdiqlangan${r.confirmedByIsm ? ` · ${r.confirmedByIsm}` : ""}`
                      : "🟡 Tasdiqlanmagan"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Money value={r.jamiSumma} size="md" tone="neutral" />
                  <p className="text-2xs text-faint tnum">
                    💵 {r.naqdSumma.toLocaleString("uz-UZ")} · 💳{" "}
                    {r.clickSumma.toLocaleString("uz-UZ")} · 📋{" "}
                    {r.qarzSumma.toLocaleString("uz-UZ")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
