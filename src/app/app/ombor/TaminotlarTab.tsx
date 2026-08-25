"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatSom, formatSomLabel, formatDateUz } from "@/lib/format";
import type { TaminotDTO, TaminotRoyxatDTO } from "@/lib/queries/ombor";
import { TaminotDetal } from "./TaminotDetal";

/**
 * TA'MINOTLAR TABI — kelgan tovarlar tarixi.
 *
 * Har qator bitta savolga javob beradi: kimdan, qachon, qancha va qanday
 * to'landi. Qarzga olinganlarda qolgan qarz alohida ko'rinadi — u
 * "Men qarzdorman" bo'limidagi summaning bir qismi.
 */
export function TaminotlarTab({
  royxat,
  onTovarKeldi,
  onYangilandi,
}: {
  royxat: TaminotRoyxatDTO;
  onTovarKeldi: () => void;
  onYangilandi: () => void;
}) {
  const [ochiq, setOchiq] = useState<TaminotDTO | null>(null);

  if (royxat.taminotlar.length === 0) {
    return (
      <EmptyState
        icon="🚚"
        title="Hali ta'minot yo'q"
        description="Tovar kelganda uni shu yerdan kiriting — ombor qoldig'i avtomatik oshadi."
        action={<Button onClick={onTovarKeldi}>+ Tovar keldi</Button>}
      />
    );
  }

  return (
    <div className="space-y-2">
      {royxat.taminotlar.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setOchiq(t)}
          className="w-full text-left bg-surface rounded-2xl border border-line shadow-card p-3 sm:p-4
                     hover:border-brand focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-brand transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xs text-muted">
                {formatDateUz(new Date(t.qabulSana ?? t.sana))}
              </p>
              <p className="font-medium text-fg truncate">{t.supplierNomi}</p>
              <p className="text-2xs text-muted tnum">
                {t.mahsulotSoni} mahsulot · {formatSom(t.jamiMiqdor)} birlik
              </p>
            </div>
            <div className="text-right shrink-0 space-y-1">
              <p className="font-semibold text-fg tnum">{formatSomLabel(t.jamiSumma)}</p>
              <TolovBelgisi t={t} />
            </div>
          </div>

          {t.qoldiqQarz > 0 && (
            <p className="mt-2 text-2xs text-debt">
              Men qarzdorman: {formatSomLabel(t.qoldiqQarz)}
            </p>
          )}
          {t.holat === "bekor" && t.bekorSabab && (
            <p className="mt-2 text-2xs text-muted">Bekor sababi: {t.bekorSabab}</p>
          )}
        </button>
      ))}

      {royxat.yanaBor && (
        <p className="text-center text-2xs text-muted pt-2">
          Eng so&apos;nggi {royxat.taminotlar.length} ta ko&apos;rsatilmoqda (jami {royxat.jami}).{" "}
          <Link href="/app/qarzlar" className="text-brand hover:underline">
            Qarzlar bo&apos;limi
          </Link>
        </p>
      )}

      {ochiq && (
        <TaminotDetal
          taminot={ochiq}
          onClose={() => setOchiq(null)}
          onYangilandi={() => {
            setOchiq(null);
            onYangilandi();
          }}
        />
      )}
    </div>
  );
}

function TolovBelgisi({ t }: { t: TaminotDTO }) {
  if (t.holat === "bekor") return <Badge tone="neutral">Bekor qilingan</Badge>;
  if (t.holat !== "qabul_qilingan") return <Badge tone="info">Kutilmoqda</Badge>;
  if (t.qoldiqQarz > 0) {
    return <Badge tone="warning">{t.tolanganSumma > 0 ? "Qisman qarz" : "📒 Qarzga"}</Badge>;
  }
  return <Badge tone="kirim">To&apos;langan</Badge>;
}
