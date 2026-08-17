"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatToshkentVaqt } from "@/lib/format";
import type { KassaHarakat } from "@/lib/queries/kassaDetal";
import { SmenaTopshirishModal, type TopshirishNishoni } from "./SmenaTopshirishModal";

/**
 * MENING KASSAM — xodimning o'z kassasidagi pul.
 *
 * Raqam ledgerdan keladi (Transaction + AccountTransfer), ya'ni Kassalar
 * sahifasidagi bilan AYNI manba. Ilgari bu sahifa alohida hisobga tayanardi
 * va bitta savolga ikki xil javob chiqardi — endi bitta haqiqat manbai bor.
 */
export function KassamClient({
  accountId,
  qoldiq,
  bugungiKirim,
  bugungiChiqim,
  harakatlar,
  nishonlar,
  kutilayotganChiqim,
}: {
  accountId: string;
  qoldiq: number;
  bugungiKirim: number;
  bugungiChiqim: number;
  harakatlar: KassaHarakat[];
  /** Kimga topshirish mumkin — boshqa faol kassalar. */
  nishonlar: TopshirishNishoni[];
  /** Tasdiq kutayotgan chiqim — hali kassada, lekin band. */
  kutilayotganChiqim: number;
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-sm text-muted">Kassangizdagi pul</p>
        <Money value={qoldiq} size="display" tone={qoldiq >= 0 ? "brand" : "expense"} />

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-line">
          <div>
            <p className="text-2xs text-muted">Bugungi kirim</p>
            <Money value={bugungiKirim} size="md" tone="income" />
          </div>
          <div>
            <p className="text-2xs text-muted">Bugungi chiqim</p>
            <Money value={bugungiChiqim} size="md" tone="expense" />
          </div>
        </div>

        {kutilayotganChiqim > 0 && (
          <p className="text-2xs text-debt mt-3">
            {kutilayotganChiqim.toLocaleString("ru-RU")} so&apos;m tasdiq kutmoqda — qabul
            qilinmaguncha kassangizda turadi, lekin qayta topshirib bo&apos;lmaydi.
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <Button onClick={() => setModal(true)} disabled={qoldiq <= 0 || nishonlar.length === 0}>
            Smenani topshirish
          </Button>
          <Link
            href={`/app/kassa/${accountId}`}
            className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-muted hover:text-fg"
          >
            To&apos;liq tarix
          </Link>
        </div>
        {nishonlar.length === 0 && (
          <p className="text-2xs text-faint mt-2">
            Topshirish uchun boshqa faol kassa yo&apos;q — direktor bilan bog&apos;laning.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-fg mb-3">So&apos;nggi harakatlar</h2>
        {harakatlar.length === 0 ? (
          <EmptyState
            icon="💵"
            title="Hali harakat yo'q"
            description="Naqd yozuv kiritsangiz yoki sizga pul o'tkazilsa — shu yerda ko'rinadi."
          />
        ) : (
          <ul className="divide-y divide-line">
            {harakatlar.map((h) => (
              <li key={`${h.turi}-${h.id}`} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-fg truncate">{h.matn}</p>
                  <p className="text-2xs text-faint">{formatToshkentVaqt(new Date(h.vaqt))}</p>
                </div>
                <p
                  className={`text-sm font-semibold tnum shrink-0 ${
                    h.summa >= 0 ? "text-income" : "text-expense"
                  }`}
                >
                  {h.summa >= 0 ? "+" : "−"}
                  {Math.abs(h.summa).toLocaleString("ru-RU")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {modal && (
        <SmenaTopshirishModal
          qoldiq={qoldiq - kutilayotganChiqim}
          nishonlar={nishonlar}
          onClose={() => setModal(false)}
          onDone={() => {
            setModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
