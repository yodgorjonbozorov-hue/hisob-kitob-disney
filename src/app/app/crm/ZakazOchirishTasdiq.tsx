"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatMoney, formatDateUZ } from "@/lib/format";
import type { BuyurtmaDTO } from "./turlar";

/**
 * ZAKAZNI O'CHIRISHNI TASDIQLASH — faqat direktor ko'radigan oyna.
 *
 * `Tranzaksiyalar → OchirishTasdiq` bilan AYNI qoida: brauzerning
 * `confirm()` i emas, chunki u qaysi yozuv o'chirilayotganini ko'rsatmaydi.
 * Bu yerda zakaz nomi, mijozi, summasi va sanasi takrorlanadi.
 *
 * O'chirish YUMSHOQ (`deletedAt` + `deletedBy`) — yozuv bazada qoladi va
 * kerak bo'lsa tiklanadi.
 */
export function ZakazOchirishTasdiq({
  b,
  band,
  onClose,
  onTasdiq,
}: {
  b: BuyurtmaDTO;
  band: boolean;
  onClose: () => void;
  onTasdiq: () => void;
}) {
  const moliyaYozilgan = Boolean(b.transactionId || b.debtId);

  return (
    <Modal open onClose={onClose} title="Zakazni o'chirish">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <p className="font-medium text-fg">{b.nomi}</p>
          <p className="text-sm text-muted">
            {b.kontakt ?? "Mijozsiz"}
            {b.tel ? ` · ${b.tel}` : ""}
          </p>
          <p className="font-display tnum font-semibold text-fg mt-1">
            {b.summa > 0 ? formatMoney(b.summa) : "Narx kiritilmagan"}
            {b.sana ? ` · ${formatDateUZ(new Date(b.sana))}` : ""}
          </p>
        </div>

        <p className="text-sm text-muted">
          Haqiqatan ham ushbu ma&apos;lumotni o&apos;chirmoqchimisiz? Zakaz doskadan chiqadi, lekin
          bazadan yo&apos;qolmaydi — kim va qachon o&apos;chirgani saqlanadi.
        </p>

        {moliyaYozilgan && (
          <p className="text-sm text-expense">
            Bu zakaz moliyaga o&apos;tgan (kirim yoki qarz yozilgan). Avval uni
            &quot;Yutildi&quot; holatidan qaytaring — shunda kirim o&apos;chadi va qarz bekor
            bo&apos;ladi, keyin o&apos;chirish mumkin.
          </p>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onClose} disabled={band}>
            Bekor qilish
          </Button>
          <Button variant="danger" onClick={onTasdiq} disabled={band || moliyaYozilgan}>
            O&apos;chirish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
