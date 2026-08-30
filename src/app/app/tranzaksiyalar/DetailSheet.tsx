"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatMoney, formatSom, formatToshkentVaqt } from "@/lib/format";
import { formatKgLabel } from "@/lib/kg";
import type { TransactionDTO } from "@/lib/queries/transactions";
import { tolovYorligi } from "./turlar";

/**
 * TRANZAKSIYA TAFSILOTI — qatorga bosilganda ochiladi (mobil'da pastdan
 * chiqadigan varaq, desktopda dialog).
 *
 * Nega kerak: telefondagi kartada uchta-to'rtta maydongina sig'adi, qolgani
 * (kassa, yaratilgan vaqt, CRM manbasi) ko'rinmaydi. Ilgari qatorga bosish
 * TO'G'RIDAN-TO'G'RI tahrirlash oynasini ochardi — ya'ni "ko'rmoqchi" bo'lgan
 * odam "o'zgartirmoqchi" bo'lgan oynaga tushardi.
 */
export function DetailSheet({
  transaction,
  canModify,
  onClose,
  onEdit,
  onDelete,
}: {
  transaction: TransactionDTO;
  canModify: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = transaction;
  const kirim = t.turi === "kirim";

  return (
    <Modal open onClose={onClose} title="Yozuv tafsiloti">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge tone={kirim ? "kirim" : "chiqim"}>{kirim ? "Kirim" : "Chiqim"}</Badge>
            <p className="mt-1.5 font-medium text-fg break-words">{t.category.nomi}</p>
          </div>
          <p
            className={`font-display tnum font-semibold text-xl whitespace-nowrap ${
              kirim ? "text-income" : "text-expense"
            }`}
          >
            {kirim ? "+" : "−"} {formatMoney(t.summa)}
          </p>
        </div>

        <dl className="divide-y divide-line rounded-xl border border-line overflow-hidden">
          <Qator yorliq="To'lov turi" qiymat={tolovYorligi(t)} />
          <Qator yorliq="Sana" qiymat={formatDate(new Date(t.sana))} />
          {/* Kg savdosi (mijozga xos): pul qanday chiqqani shu ikki sondan ko'rinadi. */}
          {t.miqdorGr != null && t.kgNarxi != null && (
            <Qator
              yorliq="Miqdor × narx"
              qiymat={`${formatKgLabel(t.miqdorGr)} × ${formatSom(t.kgNarxi)} so'm`}
            />
          )}
          <Qator yorliq="Izoh" qiymat={t.izoh ?? "—"} />
          {/* Sotuvchi — savdo kimning hisobiga yozilgani (xodim statistikasi).
              Kirituvchi bilan bir xil bo'lsa alohida qator shart emas. */}
          {t.sotuvchi && t.sotuvchi.id !== t.user.id && (
            <Qator yorliq="Sotuvchi" qiymat={t.sotuvchi.ism} />
          )}
          <Qator yorliq="Kim kiritdi" qiymat={t.user.ism} />
          {t.account && <Qator yorliq="Kassa" qiymat={t.account.nomi} />}
          {t.filial && <Qator yorliq="Filial" qiymat={t.filial} />}
          {t.crmBuyurtma && <Qator yorliq="CRM buyurtmasi" qiymat={t.crmBuyurtma.nomi} />}
          <Qator yorliq="Yaratilgan" qiymat={formatToshkentVaqt(new Date(t.createdAt))} />
        </dl>

        {canModify ? (
          <div className="flex gap-2 pt-1">
            <Button variant="danger" onClick={onDelete}>
              O&apos;chirish
            </Button>
            <Button className="ml-auto" onClick={onEdit}>
              Tahrirlash
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted">
            Bu yozuvni faqat uni kiritgan xodim yoki direktor o&apos;zgartira oladi.
          </p>
        )}
      </div>
    </Modal>
  );
}

function Qator({ yorliq, qiymat }: { yorliq: string; qiymat: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2.5">
      <dt className="text-sm text-muted shrink-0">{yorliq}</dt>
      <dd className="text-sm text-fg text-right break-words min-w-0">{qiymat}</dd>
    </div>
  );
}
