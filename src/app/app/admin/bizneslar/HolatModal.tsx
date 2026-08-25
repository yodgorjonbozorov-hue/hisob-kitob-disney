"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * NOFAOLLASHTIRISH / FAOLLASHTIRISH tasdig'i.
 *
 * Nofaollashtirish O'CHIRISH EMAS — buni foydalanuvchi oynada ANIQ o'qiydi.
 * Yozuvlar, xodimlar, hisobotlar va kassalar joyida qoladi; biznes faqat
 * menyudan va biznes tanlash ro'yxatidan chiqadi.
 */
export function HolatModal({
  biznes,
  band,
  onClose,
  onTasdiq,
}: {
  biznes: { nomi: string; isActive: boolean };
  band: boolean;
  onClose: () => void;
  onTasdiq: () => void;
}) {
  const nofaollashtirish = biznes.isActive;
  return (
    <Modal
      open
      onClose={onClose}
      title={nofaollashtirish ? "Biznesni nofaollashtirish" : "Biznesni faollashtirish"}
    >
      <div className="space-y-4">
        {nofaollashtirish ? (
          <>
            <p className="text-sm text-fg">
              <span className="font-medium">{biznes.nomi}</span> vaqtincha nofaol qilinadi.
            </p>
            <ul className="text-sm text-muted space-y-1.5 rounded-xl bg-surface-2 p-3 list-none">
              <li>· Yozuvlar o&apos;chmaydi</li>
              <li>· Xodimlar o&apos;chmaydi</li>
              <li>· Hisobotlar o&apos;chmaydi</li>
              <li>· Kassa va qoldiqlar o&apos;chmaydi</li>
            </ul>
            <p className="text-xs text-faint">
              Biznes faqat menyudagi biznes tanlash ro&apos;yxatidan chiqadi. Istalgan payt qayta
              faollashtirasiz.
            </p>
          </>
        ) : (
          <p className="text-sm text-fg">
            <span className="font-medium">{biznes.nomi}</span> qayta faollashtiriladi va biznes
            tanlash ro&apos;yxatida ko&apos;rinadi.
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="button" onClick={onTasdiq} loading={band}>
            {nofaollashtirish ? "Nofaollashtirish" : "Faollashtirish"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
