"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateUz } from "@/lib/format";
import { ACCOUNT_TURI_NOMI, type AccountTuri } from "@/lib/validation/account";
import type { AccountQoldiq, TransferDTO } from "@/lib/queries/accounts";
import { KassaModal } from "./KassaModal";
import { TransferModal } from "./TransferModal";

/** Kassa turi belgisi — ro'yxatda darrov ajralib tursin. */
const TURI_BELGI: Record<string, string> = { naqd: "💵", plastik: "💳", bank: "🏦" };

export interface UserOption {
  id: string;
  ism: string;
}

export function KassaClient({
  qoldiqlar,
  transferlar,
  userlar,
  pro,
}: {
  qoldiqlar: AccountQoldiq[];
  transferlar: TransferDTO[];
  /** Foydalanuvchiga o'tkazish (PRO) uchun qabul qiluvchilar. */
  userlar: UserOption[];
  pro: boolean;
}) {
  const router = useRouter();
  const [kassaModal, setKassaModal] = useState<AccountQoldiq | "yangi" | null>(null);
  const [transferModal, setTransferModal] = useState(false);

  const jami = qoldiqlar.reduce((a, q) => a + q.qoldiq, 0);
  const faollar = qoldiqlar.filter((q) => q.isActive);

  function yangilash() {
    setKassaModal(null);
    setTransferModal(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Jami qoldiq</p>
            <Money value={jami} size="display" tone={jami >= 0 ? "brand" : "expense"} />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setTransferModal(true)}
              disabled={faollar.length < 2 && !(pro && userlar.length > 0)}
            >
              Pul ko&apos;chirish
            </Button>
            <Button onClick={() => setKassaModal("yangi")}>Yangi kassa</Button>
          </div>
        </div>
        {faollar.length < 2 && !(pro && userlar.length > 0) && (
          <p className="text-2xs text-faint mt-3">
            Pul ko&apos;chirish uchun kamida ikkita faol kassa kerak.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {qoldiqlar.map((q) => (
          <button
            key={q.id}
            onClick={() => setKassaModal(q)}
            className={`text-left bg-surface border rounded-2xl p-5 transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              q.isActive ? "border-line" : "border-line opacity-60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg truncate">
                {q.userId ? "👤" : TURI_BELGI[q.turi] ?? "💰"} {q.nomi}
              </p>
              {!q.isActive && <span className="text-2xs text-faint shrink-0">nofaol</span>}
            </div>
            <p className="text-2xs text-faint mt-0.5">
              {q.userId
                ? `Shaxsiy kassa · ${q.egaIsm ?? "egasi o'chirilgan"}`
                : ACCOUNT_TURI_NOMI[q.turi as AccountTuri] ?? q.turi}
            </p>
            <div className="mt-3">
              <Money value={q.qoldiq} size="xl" tone={q.qoldiq >= 0 ? "neutral" : "expense"} />
            </div>
            <div className="mt-3 space-y-1 text-2xs text-muted tnum">
              <p>
                Kirim: <Money value={q.kirim} size="sm" tone="income" />
              </p>
              <p>
                Chiqim: <Money value={q.chiqim} size="sm" tone="expense" />
              </p>
              {(q.kirganTransfer > 0 || q.chiqqanTransfer > 0) && (
                <p>
                  Ko&apos;chirish: +{q.kirganTransfer.toLocaleString("uz-UZ")} / −
                  {q.chiqqanTransfer.toLocaleString("uz-UZ")}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      <Card>
        <h2 className="font-semibold text-fg mb-3">So&apos;nggi ko&apos;chirishlar</h2>
        {transferlar.length === 0 ? (
          <EmptyState
            icon="↔"
            title="Hali pul ko'chirilmagan"
            description="Kassadan bankka yoki aksincha pul o'tkazsangiz — shu yerda ko'rinadi."
          />
        ) : (
          <ul className="divide-y divide-line">
            {transferlar.map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm truncate ${t.holat === "bekor" ? "text-faint line-through" : "text-fg"}`}>
                    {t.fromUserIsm && t.toUserIsm
                      ? `${t.fromUserIsm} → ${t.toUserIsm}`
                      : `${t.fromNomi} → ${t.toNomi}`}
                  </p>
                  <p className="text-2xs text-faint">
                    {formatDateUz(new Date(t.sana))}
                    {t.izoh ? ` · ${t.izoh}` : ""}
                    {t.holat === "bekor" ? " · bekor qilingan" : ""}
                  </p>
                </div>
                <Money value={t.summa} size="md" tone="neutral" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {kassaModal && (
        <KassaModal
          kassa={kassaModal === "yangi" ? null : kassaModal}
          onClose={() => setKassaModal(null)}
          onDone={yangilash}
        />
      )}
      {transferModal && (
        <TransferModal
          kassalar={faollar}
          userlar={pro ? userlar : []}
          onClose={() => setTransferModal(false)}
          onDone={yangilash}
        />
      )}
    </div>
  );
}
