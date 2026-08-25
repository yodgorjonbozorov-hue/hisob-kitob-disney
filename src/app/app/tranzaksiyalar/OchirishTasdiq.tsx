"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatDateUZ, formatMoney } from "@/lib/format";
import type { TransactionDTO } from "@/lib/queries/transactions";

/**
 * O'CHIRISHNI TASDIQLASH.
 *
 * Brauzerning `confirm()` i emas: telefonda u sahifa tepasida chiqadi,
 * qaysi yozuv o'chirilayotganini KO'RSATMAYDI va uslub jihatidan ilovadan
 * ajralib turadi. Bu oyna esa summa, kategoriya va sanani takrorlaydi —
 * "qaysi birini bosdim" degan savol qolmaydi.
 *
 * O'chirish soft-delete: yozuv savatga tushadi va toast'dagi "Qaytarish"
 * bilan tiklanadi.
 */
export function OchirishTasdiq({
  transaction,
  onClose,
  onConfirm,
}: {
  transaction: TransactionDTO;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const kirim = transaction.turi === "kirim";
  return (
    <Modal open onClose={onClose} title="Yozuvni o'chirish">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <p className="font-medium text-fg">{transaction.category.nomi}</p>
          <p className={`font-display tnum font-semibold ${kirim ? "text-income" : "text-expense"}`}>
            {kirim ? "+" : "−"} {formatMoney(transaction.summa)}
          </p>
          <p className="text-xs text-muted mt-1">
            {formatDateUZ(new Date(transaction.sana))} · {transaction.user.ism}
          </p>
        </div>
        <p className="text-sm text-muted">
          Yozuv o&apos;chiriladi va jamilardan chiqadi. Xato bo&apos;lsa darhol
          &quot;Qaytarish&quot; bilan tiklay olasiz.
        </p>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            O&apos;chirish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
