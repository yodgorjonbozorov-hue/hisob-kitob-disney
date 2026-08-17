"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatToshkentVaqt } from "@/lib/format";
import type { AccountQoldiq, KassaKunlik, TransferDTO } from "@/lib/queries/accounts";
import { KassaKarta } from "./KassaKarta";
import { KassaModal } from "./KassaModal";
import { TransferModal } from "./TransferModal";

/**
 * KASSALAR PANELI.
 *
 * Barcha xodimlar barcha kassalarni KO'RADI (pul qayerda ekani sir emas),
 * lekin BOSHQARUV amallari (kassa ochish/tahrirlash) faqat boshqaruvchida.
 * Ruxsatlar serverda ham mustaqil tekshiriladi — bu yerdagi bayroqlar
 * shunchaki keraksiz tugmani ko'rsatmaydi.
 */
export function KassaClient({
  qoldiqlar,
  kunlik,
  transferlar,
  meniUserId,
  meniKassam,
  boshqaruvchi,
  transferQila,
}: {
  qoldiqlar: AccountQoldiq[];
  /** accountId → bugungi kirim/chiqim. */
  kunlik: Record<string, KassaKunlik>;
  /** So'nggi YAKUNLANGAN o'tkazmalar. */
  transferlar: TransferDTO[];
  meniUserId: string;
  meniKassam: string | null;
  boshqaruvchi: boolean;
  /** "pul.berish" huquqi bormi. */
  transferQila: boolean;
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
            <p className="text-sm text-muted">Jami kassalar</p>
            <Money value={jami} size="display" tone={jami >= 0 ? "brand" : "expense"} />
          </div>
          <div className="flex gap-2">
            {transferQila && (
              <Button
                variant="secondary"
                onClick={() => setTransferModal(true)}
                disabled={faollar.length < 2}
              >
                Pul o&apos;tkazish
              </Button>
            )}
            {boshqaruvchi && <Button onClick={() => setKassaModal("yangi")}>Yangi kassa</Button>}
          </div>
        </div>
        {faollar.length < 2 && transferQila && (
          <p className="text-2xs text-faint mt-3">
            Pul o&apos;tkazish uchun kamida ikkita faol kassa kerak.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {qoldiqlar.map((q) => (
          <KassaKarta
            key={q.id}
            kassa={q}
            kunlik={kunlik[q.id]}
            meniki={q.userId === meniUserId}
            onTahrir={boshqaruvchi ? () => setKassaModal(q) : undefined}
          />
        ))}
      </div>

      <Card>
        <h2 className="font-semibold text-fg mb-3">So&apos;nggi o&apos;tkazmalar</h2>
        {transferlar.length === 0 ? (
          <EmptyState
            icon="↔"
            title="Hali pul o'tkazilmagan"
            description="Bir kassadan boshqasiga pul o'tkazsangiz — shu yerda ko'rinadi."
          />
        ) : (
          <ul className="divide-y divide-line">
            {transferlar.map((t) => {
              const bekor = t.holat === "bekor";
              const rad = t.holat === "rad";
              return (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`text-sm truncate ${
                        bekor || rad ? "text-faint line-through" : "text-fg"
                      }`}
                    >
                      {t.fromUserIsm ?? t.fromNomi} → {t.toUserIsm ?? t.toNomi}
                    </p>
                    <p className="text-2xs text-faint">
                      {formatToshkentVaqt(new Date(t.createdAt))}
                      {t.turi === "smena" ? " · Smena topshirish" : ""}
                      {t.izoh ? ` · ${t.izoh}` : ""}
                      {bekor ? " · bekor qilingan" : ""}
                      {rad ? " · rad etilgan" : ""}
                    </p>
                  </div>
                  <Money value={t.summa} size="md" tone="neutral" />
                </li>
              );
            })}
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
          meniKassam={meniKassam}
          onClose={() => setTransferModal(false)}
          onDone={yangilash}
        />
      )}
    </div>
  );
}
