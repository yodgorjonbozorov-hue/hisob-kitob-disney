"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatToshkentVaqt } from "@/lib/format";
import type { AccountQoldiq, KassaKunlik, TransferDTO } from "@/lib/queries/accounts";
import { KassaKarta } from "./KassaKarta";
import { KassaModal } from "./KassaModal";
import { TransferModal } from "./TransferModal";

/**
 * O'tkazma holatining yorlig'i. "bajarildi" ataylab yorliqsiz — u odatiy
 * holat va har qatorga rangli belgi qo'yish ro'yxatni o'qib bo'lmas qiladi.
 */
const HOLAT_YORLIQ: Record<string, { matn: string; tone: "warning" | "neutral" | "chiqim" }> = {
  kutilmoqda: { matn: "Kutilmoqda", tone: "warning" },
  rad: { matn: "Rad etilgan", tone: "chiqim" },
  bekor: { matn: "Bekor qilingan", tone: "neutral" },
  arxiv: { matn: "Arxiv", tone: "neutral" },
};

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
        <h2 className="font-semibold text-fg mb-1">Kassa harakatlari</h2>
        <p className="text-2xs text-faint mb-3">
          Barcha pul o&apos;tkazmalari va smena topshiriqlari — yangi ham, eski tizimdan
          ko&apos;chirilgan arxiv ham bitta ro&apos;yxatda.
        </p>
        {transferlar.length === 0 ? (
          <EmptyState
            icon="↔"
            title="Hali harakat yo'q"
            description="Bir kassadan boshqasiga pul o'tkazsangiz — shu yerda ko'rinadi."
          />
        ) : (
          <ul className="divide-y divide-line">
            {transferlar.map((t) => {
              const holat = HOLAT_YORLIQ[t.holat];
              const otmagan = t.holat === "bekor" || t.holat === "rad";
              return (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`text-sm truncate ${otmagan ? "text-faint line-through" : "text-fg"}`}
                    >
                      {t.fromUserIsm ?? t.fromNomi} → {t.toUserIsm ?? t.toNomi}
                    </p>
                    <p className="text-2xs text-faint">
                      {formatToshkentVaqt(new Date(t.createdAt))}
                      {t.turi === "smena" ? " · Smena topshirish" : ""}
                      {t.izoh ? ` · ${t.izoh}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {holat && <Badge tone={holat.tone}>{holat.matn}</Badge>}
                    <Money value={t.summa} size="md" tone="neutral" />
                  </div>
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
