"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";
import type { BuyurtmaDTO } from "./turlar";

/** Tez tanlanadigan sabablar — yozishga vaqt ketmasin (matn baribir tahrirlanadi). */
const TAYYOR_SABABLAR = [
  "Narx kelishmadi",
  "Mijoz raqamni ko'tarmadi",
  "Raqobatchiga ketdi",
  "Sana bo'sh emas edi",
  "Mijoz rejasini bekor qildi",
];

/**
 * ZAKAZNI "YO'QOTILDI" GA O'TKAZISH — SABAB BILAN.
 *
 * NEGA MAJBURIY: direktor arxivining butun ma'nosi "qancha pul qo'ldan
 * ketdi" dan keyingi savolda — "nega". Sababsiz yo'qotilgan zakazlar
 * ro'yxati shunchaki o'lik ro'yxat bo'lib qolardi.
 *
 * Brauzerning `prompt()` i ATAYLAB ishlatilmaydi (`OchirishTasdiq` bilan
 * bir xil qoida): telefonda u qaysi zakaz haqida ekanini ko'rsatmaydi va
 * ilovadan ajralib turadi. Bu oyna zakaz nomi va summasini takrorlaydi.
 */
export function YoqotishSababiModal({
  b,
  band,
  onClose,
  onTasdiq,
}: {
  b: BuyurtmaDTO;
  /** So'rov ketayotgan payt — tugma ikki marta bosilmasin. */
  band: boolean;
  onClose: () => void;
  onTasdiq: (sabab: string) => void;
}) {
  const [sabab, setSabab] = useState("");
  const tayyor = sabab.trim().length > 0;

  return (
    <Modal open onClose={onClose} title="Zakaz yo'qotildi">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <p className="font-medium text-fg">{b.nomi}</p>
          <p className="text-sm text-muted">
            {b.kontakt ?? "Mijozsiz"}
            {b.tel ? ` · ${b.tel}` : ""}
          </p>
          {b.summa > 0 && (
            <p className="font-display tnum font-semibold text-expense mt-1">{formatMoney(b.summa)}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="yoqotish-sabab" className="block text-sm font-medium text-fg">
            Nega yo&apos;qotildi?
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TAYYOR_SABABLAR.map((t) => (
              <button
                key={t}
                onClick={() => setSabab(t)}
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-2xs text-muted hover:text-fg"
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            id="yoqotish-sabab"
            value={sabab}
            onChange={(e) => setSabab(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Masalan: narx kelishmadi, mijoz boshqa joydan buyurtma berdi"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
          />
          <p className="text-2xs text-faint">
            Sabab zakaz kartochkasida va direktor arxivida ko&apos;rinadi. Zakaz boshqa holatga
            qaytarilsa sabab o&apos;chadi.
          </p>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onClose} disabled={band}>
            Bekor qilish
          </Button>
          <Button variant="danger" onClick={() => onTasdiq(sabab.trim())} disabled={!tayyor || band}>
            Yo&apos;qotildi deb belgilash
          </Button>
        </div>
      </div>
    </Modal>
  );
}
