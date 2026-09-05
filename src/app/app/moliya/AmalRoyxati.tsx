"use client";

import { formatDateUz, formatSom, formatToshkentSoat } from "@/lib/format";
import { SHAXS_KIMDAN } from "@/lib/moliya/shaxs";
import { PUL_USULI_BELGI, PUL_USULI_NOMI } from "@/lib/moliya/usul";
import type { PulHarakatiDTO } from "./turlar";

/**
 * PUL HARAKATLARI RO'YXATI — mobil uchun kartalar (jadval EMAS).
 *
 * Har kartada 15-talabdagi hamma narsa ko'rinadi: kimdan/kimga, sabab,
 * summa (kirim yashil "+", chiqim qizil "−"), to'lov usuli, kassa, sana va
 * kim kiritgan.
 *
 * BIR AMAL — BIR NECHA QATOR bo'lishi mumkin: qarz to'lovi bir necha qarzga
 * taqsimlansa har qarz uchun alohida yozuv bo'ladi (kategoriya kesimi
 * saqlansin — lib/services/qarz.ts). Ular jamlanmaydi, chunki har biri o'z
 * kategoriyasiga tegishli; tuzatish va bekor qilish esa `amalId` bo'yicha
 * butun amalga birdan tegadi.
 */
export function AmalRoyxati({
  items,
  boshqaruvchi,
  onTahrir,
  onBekor,
  bandAmalId,
}: {
  items: PulHarakatiDTO[];
  /** Direktor: tuzatish va bekor qilish tugmalari (11-talab). */
  boshqaruvchi: boolean;
  onTahrir: (amal: PulHarakatiDTO) => void;
  onBekor: (amal: PulHarakatiDTO) => void;
  bandAmalId: string | null;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-sm text-muted">Bu davrda pul harakati yo&apos;q.</p>
        <p className="text-xs text-faint mt-1">
          Yuqoridagi &laquo;Pul oldim&raquo; yoki &laquo;Pul berdim&raquo; tugmasi bilan
          boshlang.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((a) => {
        const kirim = a.yonalish === "kirim";
        return (
          <li
            key={a.id}
            className="rounded-xl border border-line bg-surface px-3 py-3 sm:px-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg truncate">
                  {a.shaxsIsm ?? "—"}
                  {a.shaxsTuri && (
                    <span className="ml-1.5 text-2xs font-normal text-faint">
                      {SHAXS_KIMDAN[a.shaxsTuri]}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted truncate">{a.sabab}</p>
                {a.izoh && <p className="text-2xs text-faint truncate">{a.izoh}</p>}
              </div>
              <p
                className={`shrink-0 text-base font-semibold tnum ${
                  kirim ? "text-income" : "text-expense"
                }`}
              >
                {kirim ? "+" : "−"}
                {formatSom(a.summa)}
              </p>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-faint">
              <span>
                {PUL_USULI_BELGI[a.usul]} {PUL_USULI_NOMI[a.usul]}
              </span>
              {a.kassaNomi && <span>{a.kassaNomi}</span>}
              <span>
                {formatDateUz(new Date(a.sana))} · {formatToshkentSoat(new Date(a.createdAt))}
              </span>
              <span>{a.kiritgan}</span>
              {a.qarzBogliq && <span className="text-debt">Qarzga bog&apos;langan</span>}
            </div>

            {boshqaruvchi && a.tahrirlanadi && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={bandAmalId === a.amalId}
                  onClick={() => onTahrir(a)}
                  className="rounded-lg border border-line px-3 py-1.5 text-2xs text-muted hover:text-fg hover:border-line-strong disabled:opacity-50"
                >
                  Tuzatish
                </button>
                <button
                  type="button"
                  disabled={bandAmalId === a.amalId}
                  onClick={() => onBekor(a)}
                  className="rounded-lg border border-line px-3 py-1.5 text-2xs text-expense hover:border-expense disabled:opacity-50"
                >
                  Bekor qilish
                </button>
              </div>
            )}
            {boshqaruvchi && !a.tahrirlanadi && (
              <p className="mt-2 text-2xs text-faint">
                Bu yozuv boshqa bo&apos;limdan (sotuv, xarid, oylik yoki CRM) kelgan — o&apos;sha
                yerdan tuzatiladi.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
