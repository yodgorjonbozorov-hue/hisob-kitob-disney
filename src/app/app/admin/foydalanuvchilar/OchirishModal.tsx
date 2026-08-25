"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import type { XodimDTO } from "./turlar";

/**
 * XAVFLI ZONA — xodimni butunlay o'chirish.
 *
 * O'chirish ASOSIY amal EMAS va bo'lmasligi kerak: xodimning yozuvlari
 * (tranzaksiya, qarz, kassa, audit) uning ismiga bog'langan. Server yozuvi
 * bor xodimni o'chirmaydi — bu oynada esa buni OLDINDAN aytamiz va
 * xavfsizroq yo'lni (nofaollashtirish) birinchi tugma qilib qo'yamiz.
 *
 * Ismni qayta yozish talabi — "tasdiqlash" tugmasini o'ylamay bosishning
 * oldini oladi.
 */
export function OchirishModal({
  xodim,
  onNofaollashtir,
  onOchir,
  onClose,
}: {
  xodim: XodimDTO;
  onNofaollashtir: () => void;
  onOchir: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [matn, setMatn] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mos = matn.trim().toLowerCase() === xodim.ism.trim().toLowerCase();

  return (
    <Modal open onClose={onClose} title="Xodimni o'chirish">
      <div className="space-y-4">
        <p className="text-sm text-fg">
          <span className="font-medium">{xodim.ism}</span> ({xodim.login}) butunlay
          o&apos;chiriladi. Buni ORQAGA QAYTARIB BO&apos;LMAYDI.
        </p>

        <div className="rounded-lg bg-surface-2 px-3 py-2.5 space-y-2">
          <p className="text-xs text-muted">
            Xodimning tranzaksiya, qarz, kassa yoki hisobot yozuvlari bo&apos;lsa —
            u o&apos;chmaydi (tarix yo&apos;qolmasligi kerak).
          </p>
          <p className="text-xs text-fg">
            Ko&apos;p hollarda kerak bo&apos;ladigan narsa — <b>nofaollashtirish</b>: xodim
            tizimga kira olmaydi, lekin uning nomi va butun tarixi joyida qoladi.
          </p>
          {xodim.isActive && (
            <Button variant="secondary" size="sm" onClick={onNofaollashtir}>
              Nofaollashtirish
            </Button>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1.5" htmlFor="ochirish-tasdiq">
            Davom etish uchun <span className="font-medium text-fg">{xodim.ism}</span> deb yozing
          </label>
          <input
            id="ochirish-tasdiq"
            value={matn}
            onChange={(e) => setMatn(e.target.value)}
            className={INPUT_CLASS}
            autoComplete="off"
          />
        </div>

        {xato && <p className="text-expense text-sm">{xato}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button
            variant="danger"
            disabled={!mos}
            loading={loading}
            onClick={async () => {
              setLoading(true);
              setXato(null);
              const x = await onOchir();
              if (x) {
                setXato(x);
                setLoading(false);
              }
            }}
          >
            Butunlay o&apos;chirish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
