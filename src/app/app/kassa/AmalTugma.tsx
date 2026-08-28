"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

export interface Amal {
  label: string;
  izoh: string;
  onClick: () => void;
  ochiq: boolean;
  /** Amal hozir mumkin emas — sabab ko'rsatiladi (tugma o'chiq). */
  sabab?: string;
}

/**
 * MOBIL YOPISHQOQ AMAL TUGMASI.
 *
 * Telefonda asosiy amallar ekranning tepasida qolib ketadi — kassalar
 * ro'yxatini aylantirgan odam "Pul o'tkazish" tugmasiga qaytish uchun yuqoriga
 * chiqishi kerak bo'lardi. Tugma pastda, BARMOQ yetadigan joyda turadi.
 *
 * `bottom-[4.75rem]` — pastki navigatsiya balandligi (h-14 + iyak). Shu bois
 * tugma tab-bar bilan URISHMAYDI; ilovaning boshqa sahifalarida ham aynan shu
 * o'lchov ishlatiladi (tranzaksiyalar sahifasi).
 *
 * Bosilganda pastdan varaq (bottom sheet) chiqadi — `Modal` mobil'da aynan
 * shunday ko'rinadi va iPhone xavfsiz zonasi hisobga olingan.
 */
export function AmalTugma({ amallar }: { amallar: Amal[] }) {
  const [ochiq, setOchiq] = useState(false);
  const korinadigan = amallar.filter((a) => a.ochiq);
  if (korinadigan.length === 0) return null;

  return (
    <>
      <div className="lg:hidden sticky bottom-[4.75rem] z-30 flex justify-end pointer-events-none">
        <button
          type="button"
          onClick={() => setOchiq(true)}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-brand text-brand-fg shadow-raised px-5 min-h-[48px] font-medium active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-app"
        >
          <span aria-hidden="true">+</span> Amal
        </button>
      </div>

      {ochiq && (
        <Modal open onClose={() => setOchiq(false)} title="Kassa amallari">
          <div className="space-y-2 pb-2">
            {korinadigan.map((a) => {
              const ochiqmi = !a.sabab;
              return (
                <button
                  key={a.label}
                  type="button"
                  disabled={!ochiqmi}
                  onClick={() => {
                    setOchiq(false);
                    a.onClick();
                  }}
                  className="w-full text-left rounded-xl border border-line bg-surface-2 px-4 py-3 min-h-[56px] disabled:opacity-50 hover:border-brand transition"
                >
                  <span className="block text-sm font-medium text-fg">{a.label}</span>
                  <span className="block text-2xs text-muted mt-0.5">{a.sabab ?? a.izoh}</span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}
