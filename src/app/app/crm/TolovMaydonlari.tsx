"use client";

import { Select } from "@/components/ui/Select";
import { formatMoney, parseSomInput } from "@/lib/format";
import { TOLOV_KANALLARI, TOLOV_KANAL_NOMI, type TolovSatri } from "@/lib/crm/tolovlar";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * TO'LOVLAR BLOKI — bitta zakaz bir necha KANAL bilan to'lanishi mumkin.
 *
 * Misol: 1 000 000 lik zakaz — naqd 300 000 + click 400 000 + terminal
 * 200 000, qolgan 100 000 esa QARZ.
 *
 * QARZ QATOR EMAS (`lib/crm/tolovlar.ts` bilan bir xil qoida): u zakaz
 * summasidan QOLGAN qism. Shuning uchun kanallar ro'yxatida "qarz" yo'q va
 * pastda faqat "Qoldiq" ko'rsatiladi — u Yutildi bosilganda qarzdorlikka
 * yoziladi.
 *
 * TO'LOV QATORI UMUMAN BO'LMASA zakaz "to'lovi tanlanmagan" bo'lib qoladi
 * va Yutildi hech qanday moliyaviy yozuv yaratmaydi. To'lovsiz zakazni
 * ataylab qarzga yozish uchun "Qarzga" belgisi bor — qarz FAQAT
 * foydalanuvchi tanlovi bilan ochiladi.
 */

/** Forma qatori: summa XOM MATN (foydalanuvchi kiritayotgan holat). */
export interface TolovQatori {
  kanal: string;
  summa: string;
}

/** Bo'sh qatorlarni tashlab, serverga yuboriladigan ko'rinishga o'tkazadi. */
export function qatorlarniTozala(qatorlar: TolovQatori[]): TolovSatri[] {
  return qatorlar
    .map((q) => ({ kanal: q.kanal, summa: q.summa ? parseSomInput(q.summa) : 0 }))
    .filter((q) => q.summa > 0);
}

/** Saqlashdan oldingi tekshiruv (server ham AYNI qoidani majburlaydi). */
export function tolovlarXatosi(narx: number, satrlar: TolovSatri[]): string | null {
  const jami = satrlar.reduce((s, t) => s + t.summa, 0);
  if (jami > narx) return "To'lovlar yig'indisi zakaz summasidan ko'p bo'lmasligi kerak";
  return null;
}

export function TolovMaydonlari({
  qatorlar,
  onQatorlar,
  narx,
  qarzga,
  onQarzga,
}: {
  qatorlar: TolovQatori[];
  onQatorlar: (v: TolovQatori[]) => void;
  narx: number;
  /** To'lov qatori bo'lmaganda: butun summa qarzdorlikka yozilsinmi. */
  qarzga: boolean;
  onQarzga: (v: boolean) => void;
}) {
  const satrlar = qatorlarniTozala(qatorlar);
  const tolangan = satrlar.reduce((s, t) => s + t.summa, 0);
  const qoldiq = Math.max(0, narx - tolangan);
  const oshib = tolangan > narx;

  function ozgartir(i: number, yangi: Partial<TolovQatori>) {
    onQatorlar(qatorlar.map((q, idx) => (idx === i ? { ...q, ...yangi } : q)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs uppercase tracking-wide text-faint">To&apos;lovlar</span>
        <button
          type="button"
          onClick={() => onQatorlar([...qatorlar, { kanal: "naqd", summa: "" }])}
          className="text-brand text-xs font-medium"
        >
          + To&apos;lov qo&apos;shish
        </button>
      </div>

      {qatorlar.length === 0 ? (
        <p className="text-2xs text-faint">
          To&apos;lov qo&apos;shilmagan — zakaz to&apos;lovsiz saqlanadi.
        </p>
      ) : (
        <div className="space-y-2">
          {qatorlar.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-32 shrink-0">
                <Select
                  value={q.kanal}
                  onChange={(v) => ozgartir(i, { kanal: v })}
                  aria-label="To'lov kanali"
                  options={TOLOV_KANALLARI.map((k) => ({ value: k, label: TOLOV_KANAL_NOMI[k] }))}
                />
              </div>
              <input
                value={q.summa}
                onChange={(e) => ozgartir(i, { summa: e.target.value })}
                placeholder="200000"
                inputMode="numeric"
                aria-label="To'lov summasi"
                className={INPUT}
              />
              <button
                type="button"
                onClick={() => onQatorlar(qatorlar.filter((_, idx) => idx !== i))}
                aria-label="To'lovni o'chirish"
                className="shrink-0 px-2 py-2 text-muted hover:text-expense"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {narx > 0 && (
        <div className="text-2xs tnum space-y-0.5">
          <p className={oshib ? "text-expense font-medium" : "text-muted"}>
            To&apos;langan: {formatMoney(tolangan)}
          </p>
          <p className={qoldiq > 0 ? "text-debt-fg" : "text-muted"}>Qoldiq: {formatMoney(qoldiq)}</p>
          {oshib && (
            <p className="text-expense">
              To&apos;lovlar yig&apos;indisi zakaz summasidan ko&apos;p bo&apos;lmasligi kerak.
            </p>
          )}
        </div>
      )}

      {/* QARZ — kanal emas, QOLDIQ. Qator bo'lsa qoldiq o'zi qarzdorlikka
          yoziladi; qatorsiz zakazda esa qarz FAQAT shu belgi bilan ochiladi. */}
      {narx > 0 && qoldiq > 0 && satrlar.length > 0 && (
        <p className="text-2xs text-faint">
          Yutildi bosilganda: Kirim {formatMoney(tolangan)} · Qarzdorlik {formatMoney(qoldiq)}
        </p>
      )}
      {narx > 0 && satrlar.length === 0 && (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={qarzga}
            onChange={(e) => onQarzga(e.target.checked)}
            className="w-5 h-5"
          />
          Qarzga: butun summa ({formatMoney(narx)}) qarzdorlikka yozilsin
        </label>
      )}
    </div>
  );
}
