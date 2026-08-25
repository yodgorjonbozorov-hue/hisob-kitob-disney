"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatSom, formatSomLabel, formatDateUz } from "@/lib/format";
import { telKorinish } from "@/lib/validation/qarz";
import type { QarzdorDTO } from "@/lib/queries/qarz";
import { QarzMuddatBadge } from "./QarzMuddatBadge";

/**
 * QARZDORLAR RO'YXATI — har qatorda bitta SHAXS.
 *
 * Qarz yozuvlari jadvali (QarzJadval) "qaysi savdo qarzga ketdi" savoliga
 * javob beradi; bu ro'yxat esa kundalik savolga: "kim qancha qarzdor,
 * qanchasi kechikkan va oxirgi marta qachon to'lagan". Shu bois eng katta
 * element — SUMMA, undan keyingisi — kechikkan qism.
 *
 * MOBIL-BIRINCHI (19-talab): 375px da bitta ustunli kartalar, matnlar
 * `truncate`/`break-words` bilan — uzun ism yoki telefon kartani kengaytirib
 * gorizontal skroll keltirib chiqarmaydi. Kengroq ekranda ikki ustun.
 *
 * KARTA — TUGMA EMAS: ichida "To'lov qabul qilish" va "Qo'ng'iroq" kabi
 * boshqa amallar bor, tugma ichiga tugma joylash noto'g'ri HTML bo'lardi.
 * Shuning uchun ochish uchun alohida ustki qatlam tugmasi ishlatiladi.
 */
export function QarzdorRoyxat({
  qarzdorlar,
  onOch,
  onTolov,
  onQarzQosh,
  bosh,
  beriladigan,
}: {
  qarzdorlar: QarzdorDTO[];
  onOch: (q: QarzdorDTO) => void;
  /** Ro'yxatdan to'g'ridan-to'g'ri to'lov — eng ko'p bosiladigan amal. */
  onTolov: (q: QarzdorDTO) => void;
  onQarzQosh: () => void;
  /** Filtr emas, umuman qarz yo'q — boshqa matn ko'rsatiladi. */
  bosh: boolean;
  beriladigan: boolean;
}) {
  if (qarzdorlar.length === 0) {
    return (
      <Card className="text-center py-10">
        <p className="text-3xl mb-2" aria-hidden>
          🧾
        </p>
        <p className="font-semibold text-fg">
          {bosh ? "Qarzdorlik mavjud emas" : "Bu filtrga mos qarzdor yo'q"}
        </p>
        <p className="text-sm text-muted mt-1 mb-4">
          {bosh
            ? beriladigan
              ? "Hozircha hech kimga qarzdor emassiz."
              : "Hozircha hech kim sizga qarzdor emas."
            : "Filtrni yoki qidiruvni o'zgartirib ko'ring."}
        </p>
        {bosh && <Button onClick={onQarzQosh}>+ Qarz qo&apos;shish</Button>}
      </Card>
    );
  }

  return (
    <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {qarzdorlar.map((q) => (
        <li
          key={`${q.turi}:${q.kalit}`}
          className="relative bg-surface rounded-2xl shadow-card border border-line p-4 transition hover:border-brand focus-within:border-brand"
        >
          {/* Kartaning "ochish" yuzasi: amallar tugmalari ustida turmaydi
              (ular `relative z-10` bilan yuqorida), shuning uchun ular
              bosilganda tafsilot ochilib ketmaydi. */}
          <button
            type="button"
            onClick={() => onOch(q)}
            className="absolute inset-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label={`${q.ism} — qarz tafsilotini ochish`}
          />

          <div className="relative pointer-events-none space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-fg truncate">{q.ism}</p>
                {q.tel ? (
                  <a
                    href={`tel:${q.tel}`}
                    onClick={(e) => e.stopPropagation()}
                    className="pointer-events-auto relative z-10 inline-flex items-center gap-1 text-2xs text-muted hover:text-brand truncate"
                  >
                    <span aria-hidden>📞</span>
                    {telKorinish(q.tel)}
                  </a>
                ) : (
                  <p className="text-2xs text-faint">telefon kiritilmagan</p>
                )}
              </div>
              <QarzMuddatBadge holat={q.muddatHolat} kun={q.muddatKun} kichik />
            </div>

            {/* Qarz miqdori — kartadagi eng muhim vizual element. Bu SHAXSNING
                barcha ochiq qarzlari yig'indisi, bitta yozuv emas. */}
            <div>
              <p className="text-2xs text-muted">
                {beriladigan ? "Jami majburiyat" : "Jami qarz"}
              </p>
              <p className="text-2xl font-bold tnum text-debt break-words">
                {formatSomLabel(q.qarz)}
              </p>
              <p className="text-2xs text-muted mt-0.5">
                {q.ochiqSoni} ta ochiq qarz
                {q.status === "PARTIALLY_PAID" && " · qisman to'langan"}
              </p>
            </div>

            {q.muddatiOtganSumma > 0 && (
              <p className="text-xs font-medium text-expense tnum">
                {formatSom(q.muddatiOtganSumma)} so&apos;m muddati o&apos;tgan
              </p>
            )}

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-2xs">
              <div className="min-w-0">
                <dt className="text-faint">Eng eski qarz</dt>
                <dd className="text-fg truncate">{q.eskiKun} kun</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-faint">Eng yaqin muddat</dt>
                <dd className="text-fg truncate">
                  {q.yaqinMuddat ? formatDateUz(new Date(q.yaqinMuddat)) : "belgilanmagan"}
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-faint">Oxirgi to&apos;lov</dt>
                <dd className="text-fg truncate">
                  {q.oxirgiTolov
                    ? `${formatDateUz(new Date(q.oxirgiTolov))}${
                        q.oxirgiTolovSumma ? ` · ${formatSom(q.oxirgiTolovSumma)} so'm` : ""
                      }`
                    : "hali to'lov qilinmagan"}
                </dd>
              </div>
            </dl>

            <div className="pointer-events-auto relative z-10 flex gap-2">
              <Button
                className="flex-1 min-h-[44px]"
                onClick={(e) => {
                  e.stopPropagation();
                  onTolov(q);
                }}
              >
                {beriladigan ? "To'lov qilish" : "To'lov qabul qilish"}
              </Button>
              <Button
                variant="secondary"
                className="min-h-[44px] px-3"
                aria-label={`${q.ism} tafsiloti`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOch(q);
                }}
              >
                ⋯
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
