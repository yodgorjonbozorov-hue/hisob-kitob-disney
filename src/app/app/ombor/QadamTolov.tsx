"use client";

import { LABEL_CLASS } from "@/components/ui/fieldStyles";
import { Select } from "@/components/ui/Select";
import { TAMINOT_TOLOV_BELGI, TAMINOT_TOLOV_NOMI, type TaminotTolovUsuli } from "@/lib/validation/taminot";
import type { AccountDTO } from "@/lib/queries/accounts";

const TUSHUNTIRISH: Record<TaminotTolovUsuli, string> = {
  naqd: "Kassadan pul chiqadi",
  karta: "Click yoki plastikdan to'lanadi",
  qarz: "Keyin to'laymiz — ta'minotchiga qarz yoziladi",
};

/** Tanlangan usulga mos kassalar (qarzda kassa umuman ishtirok etmaydi). */
export function mosKassalar(usul: TaminotTolovUsuli | null, kassalar: AccountDTO[]): AccountDTO[] {
  if (usul === "naqd") return kassalar.filter((k) => k.turi === "naqd");
  if (usul === "karta") return kassalar.filter((k) => k.turi === "plastik" || k.turi === "bank");
  return [];
}

/**
 * KASSA TANLANMASDAN DAVOM ETIB BO'LMAYDIMI?
 *
 * Ilgari bu yerda "Avtomatik (birinchi kassa)" varianti bor edi va u
 * jimgina tanlanardi: pul QAYSI kassadan chiqqanini foydalanuvchi
 * bilmasdi, kechqurun esa kassa qoldig'i to'g'ri kelmasdi. Endi bir nechta
 * mos kassa bo'lsa TANLASH MAJBURIY. Kassa bitta bo'lsa savol ortiqcha —
 * u avtomatik ishlatiladi va ekranda ko'rsatiladi.
 */
export function kassaTanlashKerak(
  usul: TaminotTolovUsuli | null,
  kassalar: AccountDTO[]
): boolean {
  return mosKassalar(usul, kassalar).length > 1;
}

/**
 * 2-QADAM — QANDAY TO'LANDI?
 *
 * IKKI ASOSIY TANLOV katta tugmada: NAQD va QARZ. Natijasi HAR XIL va buni
 * foydalanuvchi bosishdan OLDIN bilishi kerak:
 *   Naqd  → kassadan pul chiqadi va CHIQIM yoziladi;
 *   Qarz  → pul umuman qimirlamaydi, "Men qarzdorman" summasi oshadi.
 *
 * Click/Karta ATAYLAB ikkinchi darajada: u naqdning bir ko'rinishi (pul
 * baribir chiqadi, faqat naqdsiz kassadan) va ko'p biznesda kamdan-kam
 * ishlatiladi. Uni butunlay olib tashlash esa naqdsiz to'lovni naqd
 * kassaga yozib, kassa qoldig'ini buzardi — shuning uchun imkoniyat
 * qoldirildi, lekin ekranning asosiy joyini egallamaydi.
 */
export function QadamTolov({
  usul,
  onUsul,
  accountId,
  onAccount,
  kassalar,
}: {
  usul: TaminotTolovUsuli | null;
  onUsul: (u: TaminotTolovUsuli) => void;
  accountId: string | null;
  onAccount: (id: string | null) => void;
  kassalar: AccountDTO[];
}) {
  const mos = mosKassalar(usul, kassalar);
  const tanlashKerak = kassaTanlashKerak(usul, kassalar);
  const yagona = mos.length === 1 ? mos[0] : null;

  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-fg">Qanday to&apos;landi?</p>

      <div className="grid grid-cols-2 gap-2">
        {(["naqd", "qarz"] as const).map((u) => {
          const faol = usul === u;
          return (
            <button
              key={u}
              type="button"
              onClick={() => {
                onUsul(u);
                onAccount(null);
              }}
              aria-pressed={faol}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-5 rounded-2xl border-2 transition min-h-[104px] ${
                faol ? "border-brand bg-brand-wash" : "border-line bg-surface hover:border-brand/50"
              }`}
            >
              <span className="text-3xl" aria-hidden>
                {TAMINOT_TOLOV_BELGI[u]}
              </span>
              <span className={`text-base font-bold ${faol ? "text-brand" : "text-fg"}`}>
                {TAMINOT_TOLOV_NOMI[u]}
              </span>
              <span className="text-2xs text-muted text-center leading-tight">
                {TUSHUNTIRISH[u]}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          onUsul("karta");
          onAccount(null);
        }}
        aria-pressed={usul === "karta"}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition min-h-[44px] ${
          usul === "karta"
            ? "border-brand bg-brand-wash text-brand font-medium"
            : "border-line bg-surface text-muted hover:text-fg"
        }`}
      >
        <span aria-hidden>{TAMINOT_TOLOV_BELGI.karta}</span>
        <span className="text-sm">{TAMINOT_TOLOV_NOMI.karta}</span>
        <span className="text-2xs text-faint ml-auto">{TUSHUNTIRISH.karta}</span>
      </button>

      {tanlashKerak && (
        <div>
          <label className={LABEL_CLASS} htmlFor="qt-kassa">
            Qaysi kassadan to&apos;landi?
          </label>
          <Select
            id="qt-kassa"
            value={accountId ?? ""}
            onChange={(v) => onAccount(v || null)}
            searchable={mos.length > 7}
            options={[
              { value: "", label: "Kassani tanlang" },
              ...mos.map((k) => ({ value: k.id, label: k.nomi })),
            ]}
          />
          {!accountId && (
            <p className="text-2xs text-debt mt-1">
              Kassa tanlanmaguncha ta&apos;minotni saqlab bo&apos;lmaydi.
            </p>
          )}
        </div>
      )}

      {yagona && (
        <p className="text-2xs text-muted bg-surface-2 rounded-lg px-3 py-2">
          Pul <span className="font-medium text-fg">{yagona.nomi}</span> kassasidan chiqadi.
        </p>
      )}

      {usul === "karta" && mos.length === 0 && (
        <p className="text-xs text-debt">
          Click/plastik kassasi topilmadi — Sozlamalar &rarr; Kassalar bo&apos;limida qo&apos;shing.
        </p>
      )}
      {usul === "naqd" && mos.length === 0 && (
        <p className="text-xs text-debt">
          Naqd kassa topilmadi — Sozlamalar &rarr; Kassalar bo&apos;limida qo&apos;shing.
        </p>
      )}
    </div>
  );
}
