"use client";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatSom, formatToshkentVaqt } from "@/lib/format";
import type { QarzAuditDTO } from "@/lib/queries/qarzAudit";

const AMAL_NOMI: Record<string, string> = {
  create: "Yaratildi",
  update: "Tuzatildi",
  delete: "O'chirildi",
  restore: "Tiklandi",
};

const AMAL_TONE: Record<string, "kirim" | "chiqim" | "warning" | "neutral"> = {
  create: "kirim",
  update: "warning",
  delete: "chiqim",
  restore: "neutral",
};

const TURI_NOMI: Record<string, string> = {
  olinadigan: "Mijoz qarzi",
  beriladigan: "Ta'minotchi qarzi",
};

/**
 * AUDIT LENTASI — mobil'da kartalar, desktopda ham AYNI ko'rinish
 * (jadval 375px ekranda o'qilmaydi va ustunlarni yashirishga majbur qilardi).
 *
 * Har kartada 7-talabdagi hamma narsa: amal, qarzdor, eski→yangi qiymat,
 * sabab, kim va qachon.
 */
export function QarzAuditRoyxat({ items }: { items: QarzAuditDTO[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Audit yozuvi yo'q"
        description="Qarzlar hali tuzatilmagan yoki o'chirilmagan."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const summaOzgardi =
          a.eskiSumma !== null && a.yangiSumma !== null && a.eskiSumma !== a.yangiSumma;
        return (
          <li key={a.id} className="rounded-xl border border-line bg-surface px-3 py-3 sm:px-4">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">{a.qarzdor ?? "—"}</p>
                <p className="text-2xs text-muted">
                  {a.turi ? (TURI_NOMI[a.turi] ?? a.turi) : "Qarz"}
                </p>
              </div>
              <Badge tone={AMAL_TONE[a.amal] ?? "neutral"}>{AMAL_NOMI[a.amal] ?? a.amal}</Badge>
            </div>

            {summaOzgardi ? (
              <p className="mt-2 text-sm tnum text-fg">
                <span className="text-faint line-through">{formatSom(a.eskiSumma!)}</span>
                {" → "}
                <span className="font-medium">{formatSom(a.yangiSumma!)}</span> so&apos;m
              </p>
            ) : (
              (a.yangiSumma ?? a.eskiSumma) !== null && (
                <p className="mt-2 text-sm tnum text-fg">
                  {formatSom((a.yangiSumma ?? a.eskiSumma)!)} so&apos;m
                </p>
              )
            )}

            {a.sabab && (
              <p className="mt-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-2xs text-muted">
                Sabab: <span className="text-fg">{a.sabab}</span>
              </p>
            )}

            <p className="mt-2 text-2xs text-faint">
              {a.kim ?? "noma'lum"} · {formatToshkentVaqt(new Date(a.vaqt))}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
