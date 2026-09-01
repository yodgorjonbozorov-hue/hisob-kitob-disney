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

/**
 * 2-QADAM — QANDAY OLINDI?
 *
 * Uchta katta tugma, uchtasi ham bir qatorli tushuntirish bilan. Bu shunchaki
 * dizayn emas — natijasi HAR XIL:
 *   Naqd/Karta → kassadan pul chiqadi va CHIQIM yoziladi;
 *   Qarzga     → pul umuman qimirlamaydi, "Men qarzdorman" summasi oshadi.
 * Foydalanuvchi buni tugmani bosishdan OLDIN bilishi kerak.
 *
 * "QAYSI KASSADAN?" faqat KERAK BO'LGANDA chiqadi: qarzga olinganda kassa
 * umuman ishtirok etmaydi, mos kassa bitta bo'lsa esa tanlash ham ortiqcha
 * savol. Foydalanuvchini oldindan maydonlar bilan qo'rqitmaslik qoidasi.
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
  // Naqd — naqd kassalar; karta — plastik/bank kassalar.
  const mos =
    usul === "naqd"
      ? kassalar.filter((k) => k.turi === "naqd")
      : usul === "karta"
        ? kassalar.filter((k) => k.turi === "plastik" || k.turi === "bank")
        : [];
  const kassaKerak = usul !== null && usul !== "qarz" && mos.length > 1;

  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-fg">Qanday olindi?</p>

      <div className="grid gap-2">
        {(["naqd", "karta", "qarz"] as const).map((u) => {
          const faol = usul === u;
          return (
            <button
              key={u}
              type="button"
              onClick={() => {
                onUsul(u);
                onAccount(null);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition min-h-[60px] ${
                faol
                  ? "border-brand bg-brand-wash"
                  : "border-line bg-surface hover:border-brand/50"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {TAMINOT_TOLOV_BELGI[u]}
              </span>
              <span className="min-w-0">
                <span className={`block font-semibold ${faol ? "text-brand" : "text-fg"}`}>
                  {TAMINOT_TOLOV_NOMI[u]}
                </span>
                <span className="block text-xs text-muted">{TUSHUNTIRISH[u]}</span>
              </span>
            </button>
          );
        })}
      </div>

      {kassaKerak && (
        <div>
          <label className={LABEL_CLASS} htmlFor="qt-kassa">
            Qaysi kassadan?
          </label>
          <Select
            id="qt-kassa"
            value={accountId ?? ""}
            onChange={(v) => onAccount(v || null)}
            searchable={mos.length > 7}
            options={[
              { value: "", label: `Avtomatik (${mos[0]?.nomi})` },
              ...mos.map((k) => ({ value: k.id, label: k.nomi })),
            ]}
          />
        </div>
      )}

      {usul === "karta" && mos.length === 0 && (
        <p className="text-xs text-debt">
          Click/plastik kassasi topilmadi — Sozlamalar &rarr; Kassalar bo&apos;limida qo&apos;shing.
        </p>
      )}
    </div>
  );
}
