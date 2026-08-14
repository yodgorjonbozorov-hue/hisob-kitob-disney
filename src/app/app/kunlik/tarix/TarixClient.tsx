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
                      : r.holat === "SUBMITTED"
                        ? `📤 Topshirilgan${r.submittedByIsm ? ` · ${r.submittedByIsm}` : ""} — tasdiq kutilmoqda`
                        : "🟡 Tasdiqlanmagan"}
                    {r.naqdFarq !== null && r.naqdFarq !== 0 && (
                      <span className="text-expense font-medium">
                        {" "}
                        · farq {r.naqdFarq < 0 ? "−" : "+"}
                        {Math.abs(r.naqdFarq).toLocaleString("uz-UZ")}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {/* Bosh raqam — kunning SOF natijasi (kirim − chiqim). */}
                  <Money value={r.sofSumma} size="md" tone="neutral" signed={r.sofSumma < 0} />
                  <p className="text-2xs text-faint tnum">
                    💵 {r.naqdSumma.toLocaleString("uz-UZ")} · 💳{" "}
                    {r.clickSumma.toLocaleString("uz-UZ")} · 📋{" "}
                    {r.qarzSumma.toLocaleString("uz-UZ")} · 📉{" "}
                    {r.chiqimSumma.toLocaleString("uz-UZ")}
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
