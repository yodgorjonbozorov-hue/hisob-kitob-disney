import { formatSom, formatToshkentVaqt } from "@/lib/format";
import type { DetalTransfer } from "@/lib/queries/kassaDetal";

/**
 * KASSA O'TKAZMALARI / TOPSHIRISHLARI RO'YXATI.
 *
 * Ikkalasi bitta komponent bilan ko'rsatiladi — farqi faqat sarlavhada va
 * topshirishda qo'shimcha "farq" qatorida. Bekor qilinganlar chizilib
 * ko'rsatiladi: yozuv o'chirilmaydi, tarix to'liq qoladi.
 */
export function TransferRoyxat({
  sarlavha,
  qatorlar,
  bosh,
}: {
  sarlavha: string;
  qatorlar: DetalTransfer[];
  /** Bo'sh holat matni — bitta qator, katta blok emas. */
  bosh: string;
}) {
  return (
    <section className="bg-surface border border-line rounded-2xl shadow-card">
      <h2 className="px-4 sm:px-5 pt-4 pb-2 font-semibold text-fg">{sarlavha}</h2>
      {qatorlar.length === 0 ? (
        <p className="px-4 sm:px-5 pb-4 text-2xs text-faint">{bosh}</p>
      ) : (
        <ul className="divide-y divide-line">
          {qatorlar.map((t) => {
            const kirgan = t.yonalish === "kirgan";
            const bekor = t.holat === "bekor";
            const farq = t.farq ?? 0;
            return (
              <li key={t.id} className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm truncate ${bekor ? "text-faint line-through" : "text-fg"}`}>
                    {kirgan ? `${t.qarshiTomon}dan` : `${t.qarshiTomon}ga`}
                  </p>
                  <p className="text-2xs text-faint mt-0.5">
                    {formatToshkentVaqt(new Date(t.vaqt))}
                    {bekor ? " · bekor qilingan" : ""}
                  </p>
                  {t.izoh && <p className="text-2xs text-muted mt-0.5 break-words">{t.izoh}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`font-display tnum text-sm font-medium whitespace-nowrap ${
                      kirgan ? "text-income" : "text-expense"
                    }`}
                  >
                    {kirgan ? "+ " : "− "}
                    {formatSom(t.summa)}
                  </p>
                  {t.hisoblangan !== null && (
                    <p
                      className={`text-2xs tnum whitespace-nowrap ${
                        farq === 0 ? "text-faint" : "text-expense"
                      }`}
                    >
                      {farq === 0 ? "Farq yo'q" : `Farq: − ${formatSom(Math.abs(farq))}`}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
