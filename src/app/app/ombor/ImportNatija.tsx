"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Natija } from "./importYuborish";

/** Import yakuni — nima qo'shildi, nima yangilandi, nimaga tegilmadi. */
export function ImportNatija({
  natija,
  rasmXabar,
  onClose,
}: {
  natija: Natija;
  /** Rasmlar taqdiri haqidagi izoh ("3 ta rasm yuklanmadi") — bo'lsa. */
  rasmXabar?: string | null;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Import yakunlandi">
      <div className="space-y-3">
        <p className="text-fg">
          Yangi qo&apos;shildi: <span className="font-semibold">{natija.qoshildi}</span> ta
        </p>
        {natija.yangilandi > 0 && (
          <p className="text-fg">
            Yangilandi: <span className="font-semibold">{natija.yangilandi}</span> ta
          </p>
        )}
        {natija.otkazildi > 0 && (
          <p className="text-muted text-sm">
            {natija.otkazildi} ta tovar bazada allaqachon bor edi — tegilmadi.
          </p>
        )}
        {rasmXabar && <p className="text-muted text-sm">{rasmXabar}</p>}
        {natija.qoldiqTogrilandi > 0 && (
          <p className="text-muted text-sm">
            {natija.qoldiqTogrilandi} ta tovarga boshlang&apos;ich qoldiq yozildi (pul harakati
            yaratilmadi).
          </p>
        )}
        {natija.xatolar.length > 0 && (
          <div className="max-h-32 overflow-y-auto space-y-1 border-t border-line pt-2">
            {natija.xatolar.slice(0, 20).map((x) => (
              <p key={x.qator} className="text-2xs text-expense">
                {x.qator}-qator: {x.xato}
              </p>
            ))}
          </div>
        )}
        <Button onClick={onClose}>Yopish</Button>
      </div>
    </Modal>
  );
}
