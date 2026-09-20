"use client";

import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";

/**
 * KG SAVDOSI (mijozga xos — Fortex Selos) yozuvini tahrirlash maydonlari.
 *
 * Summa QO'LDA tahrirlanmaydi: u har doim miqdor × 1 kg narxi (lib/kg.ts) —
 * server ham shunday qayta hisoblaydi. Aks holda tarixdagi
 * "100 kg × 5 000 = 500 000" qatori o'zaro qarama-qarshi bo'lib qolardi.
 */
export function EditKgMaydonlari({
  miqdorText,
  kgNarxText,
  kgJami,
  onMiqdor,
  onNarx,
  disabled,
}: {
  miqdorText: string;
  kgNarxText: string;
  kgJami: number;
  onMiqdor: (v: string) => void;
  onNarx: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL_CLASS} htmlFor="edit-miqdor">
            Miqdor (kg)
          </label>
          <input
            id="edit-miqdor"
            type="text"
            inputMode="decimal"
            value={miqdorText}
            disabled={disabled}
            onChange={(e) => onMiqdor(e.target.value.replace(/[^\d.,]/g, ""))}
            className={`${INPUT_CLASS} tnum`}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="edit-kg-narx">
            1 kg narxi
          </label>
          <input
            id="edit-kg-narx"
            type="text"
            inputMode="numeric"
            value={kgNarxText}
            disabled={disabled}
            onChange={(e) => onNarx(formatSom(parseSomInput(e.target.value)))}
            className={`${INPUT_CLASS} tnum`}
          />
        </div>
      </div>
      <p className="text-sm text-muted tnum">
        Jami: <span className="font-medium text-income">{formatSomLabel(kgJami)}</span>
      </p>
    </div>
  );
}
