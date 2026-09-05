"use client";

import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { formatSom, formatSomLabel } from "@/lib/format";
import { TAMINOT_TOLOV_BELGI, TAMINOT_TOLOV_NOMI, type TaminotTolovUsuli } from "@/lib/validation/taminot";
import { jamiSumma, satrSummasi, type TaminotSatr } from "./QadamMahsulotlar";

/**
 * 4-QADAM — YAKUN.
 *
 * Saqlashdan OLDIN nima yozilishi bir ekranda ko'rinadi. Ayniqsa qarzga
 * olishda: pul kassadan chiqmaydi, lekin "Men qarzdorman" summasi oshadi —
 * buni foydalanuvchi saqlagandan KEYIN emas, oldin bilishi kerak.
 *
 * SANA VA IZOH ATAYLAB SHU YERDA, birinchi qadamda emas: 10 holatdan 9 tasida
 * tovar BUGUN keladi va izoh kerak emas — ularni oldinga qo'yish har
 * ta'minotga ikkita ortiqcha savol qo'shardi. Kechagi kirimni yozayotgan
 * foydalanuvchi esa ularni oxirgi ekranda, saqlashdan oldin topadi.
 */
export function QadamYakun({
  supplierNomi,
  usul,
  satrlar,
  kassaNomi,
  sana,
  onSana,
  izoh,
  onIzoh,
}: {
  supplierNomi: string;
  usul: TaminotTolovUsuli;
  satrlar: TaminotSatr[];
  kassaNomi: string | null;
  sana: string;
  onSana: (v: string) => void;
  izoh: string;
  onIzoh: (v: string) => void;
}) {
  const jami = jamiSumma(satrlar);
  const jamiMiqdor = satrlar.reduce(
    (a, s) => a + (Number(s.miqdor.replace(/[^0-9]/g, "")) || 0),
    0
  );

  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-fg">Tekshiring va saqlang</p>

      <div className="rounded-xl border border-line divide-y divide-line">
        <Qator nomi="Ta'minotchi" qiymat={supplierNomi} />
        <Qator
          nomi="To'lov"
          qiymat={`${TAMINOT_TOLOV_BELGI[usul]} ${TAMINOT_TOLOV_NOMI[usul]}`}
        />
        {kassaNomi && <Qator nomi="Kassa" qiymat={kassaNomi} />}
        <Qator
          nomi="Mahsulot"
          qiymat={`${satrlar.length} ta · ${formatSom(jamiMiqdor)} birlik`}
        />
      </div>

      <div className="rounded-xl border border-line divide-y divide-line">
        {satrlar.map((s) => (
          <div key={s.productId} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-fg truncate">{s.nomi}</p>
              <p className="text-2xs text-muted tnum">
                {s.miqdor || 0} {s.birlik} &times; {s.birlikNarx || 0}
              </p>
            </div>
            <p className="text-sm font-medium tnum shrink-0">{formatSomLabel(satrSummasi(s))}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-base font-medium text-fg">Jami</span>
        <span className="text-xl font-bold text-fg tnum">{formatSomLabel(jami)}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="qy-sana">
            Sana
          </label>
          <input
            id="qy-sana"
            type="date"
            value={sana}
            onChange={(e) => onSana(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="qy-izoh">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="qy-izoh"
            value={izoh}
            onChange={(e) => onIzoh(e.target.value)}
            placeholder="Masalan: yuk mashinasi bilan keldi"
            maxLength={500}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {usul === "qarz" ? (
        <p className="text-xs text-debt bg-debt-soft rounded-lg px-3 py-2">
          Kassadan pul chiqmaydi. <span className="font-medium">Men qarzdorman</span> bo&apos;limida{" "}
          {supplierNomi} ga {formatSomLabel(jami)} qarz yoziladi.
        </p>
      ) : (
        <p className="text-xs text-muted bg-surface-2 rounded-lg px-3 py-2">
          {kassaNomi ? `${kassaNomi}dan` : "Kassadan"} {formatSomLabel(jami)} chiqim yoziladi.
          Ombor qoldig&apos;i darhol oshadi.
        </p>
      )}
    </div>
  );
}

function Qator({ nomi, qiymat }: { nomi: string; qiymat: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <span className="text-sm text-muted shrink-0">{nomi}</span>
      <span className="text-sm font-medium text-fg text-right min-w-0 break-words">{qiymat}</span>
    </div>
  );
}
