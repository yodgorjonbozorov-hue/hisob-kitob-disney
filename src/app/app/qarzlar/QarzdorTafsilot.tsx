"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSom, formatSomLabel, formatDateUz } from "@/lib/format";
import { telKorinish } from "@/lib/validation/qarz";
import { muddatHolati } from "@/lib/qarzMuddat";
import { todayDateOnlyString } from "@/lib/date";
import type { QarzdorTafsilotDTO } from "@/lib/queries/qarz";
import { QarzdorTarix } from "./QarzdorTarix";
import { QarzMuddatBadge } from "./QarzMuddatBadge";
import { QarzdorTolovSheet } from "./QarzdorTolovSheet";
import type { KassaOption } from "./QarzTolovForm";

/**
 * QARZDOR TAFSILOTI — bitta shaxsning butun hisob-kitobi (5-talab).
 *
 * Ma'lumot ochilganda serverdan QAYTA o'qiladi (ro'yxatdagi nusxadan emas):
 * boshqa xodim shu orada to'lov kiritgan bo'lishi mumkin.
 *
 * Uch qavat: (1) jami/to'langan/qolgan; (2) ochiq qarzlarning ro'yxati —
 * har biri o'z muddati va qoldig'i bilan; (3) butun harakat tarixi.
 *
 * TO'LOV alohida varaqda ochiladi (`QarzdorTolovSheet`): u yerda qaysi
 * qarzga qancha tushishi tasdiqlashdan OLDIN ko'rinadi.
 */
export function QarzdorTafsilot({
  kalit,
  turi,
  kassalar,
  onQarzQosh,
  onClose,
  onChanged,
}: {
  kalit: string;
  turi: string;
  kassalar: KassaOption[];
  /** "+ Qarz qo'shish" — shu qarzdor oldindan to'ldirilgan holda. */
  onQarzQosh: (q: QarzdorTafsilotDTO) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [qarzdor, setQarzdor] = useState<QarzdorTafsilotDTO | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [tolovOchiq, setTolovOchiq] = useState(false);

  const yukla = useCallback(async () => {
    setXato(null);
    try {
      const params = new URLSearchParams({ kalit, turi });
      const res = await fetch(`/api/debts/qarzdor?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Qarzdorni o'qib bo'lmadi");
        return;
      }
      setQarzdor(data);
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    }
  }, [kalit, turi]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  const beriladigan = turi === "beriladigan";
  const bugun = todayDateOnlyString();

  if (tolovOchiq && qarzdor) {
    return (
      <QarzdorTolovSheet
        ism={qarzdor.ism}
        tel={qarzdor.tel}
        turi={qarzdor.turi}
        kalit={qarzdor.kalit}
        jamiQarz={qarzdor.jamiQarz}
        ochiqQarzlar={qarzdor.ochiqQarzlar}
        kassalar={kassalar}
        onClose={() => setTolovOchiq(false)}
        onDone={async () => {
          setTolovOchiq(false);
          await yukla();
          onChanged();
        }}
      />
    );
  }

  return (
    <Modal open onClose={onClose} title={qarzdor ? qarzdor.ism : "Qarzdor"}>
      {xato && (
        <p className="text-expense text-sm" role="alert">
          {xato}
        </p>
      )}
      {!qarzdor && !xato && <p className="text-faint text-sm">Yuklanmoqda...</p>}

      {qarzdor && (
        <div className="space-y-4">
          {qarzdor.tel ? (
            <a
              href={`tel:${qarzdor.tel}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand min-h-[44px]"
            >
              <span aria-hidden>📞</span>
              {telKorinish(qarzdor.tel)}
            </a>
          ) : (
            <p className="text-sm text-faint">telefon kiritilmagan</p>
          )}

          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <p className="text-xs text-muted">{beriladigan ? "Joriy qarzim" : "Joriy qarz"}</p>
            <p className="text-2xl font-bold tnum text-debt break-words">
              {formatSomLabel(qarzdor.jamiQarz)}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-2xs">
              <div>
                <dt className="text-faint">Jami olingan</dt>
                <dd className="text-fg tnum">{formatSom(qarzdor.jamiBerilgan)} so&apos;m</dd>
              </div>
              <div>
                <dt className="text-faint">To&apos;langan</dt>
                <dd className="text-income tnum">{formatSom(qarzdor.jamiTolangan)} so&apos;m</dd>
              </div>
            </dl>
          </div>

          {/* OCHIQ QARZLAR — har biri alohida yozuv, o'z muddati bilan. */}
          {qarzdor.ochiqQarzlar.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted mb-2">
                Ochiq qarzlar ({qarzdor.ochiqQarzlar.length} ta)
              </p>
              <ul className="border border-line rounded-lg divide-y divide-line overflow-hidden">
                {qarzdor.ochiqQarzlar.map((q) => {
                  const { holat, kun } = muddatHolati(q.muddat, false, bugun);
                  return (
                    <li key={q.id} className="px-3 py-2.5 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-fg">
                            {formatDateUz(new Date(q.sana))}
                            <span className="text-muted tnum"> · {formatSom(q.jamiSumma)}</span>
                          </p>
                          {q.izoh && (
                            <p className="text-2xs text-faint truncate">{q.izoh}</p>
                          )}
                        </div>
                        <p className="text-sm font-semibold tnum text-debt whitespace-nowrap">
                          {formatSom(q.qolgan)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <QarzMuddatBadge holat={holat} kun={kun} kichik />
                        {q.tolangan > 0 && (
                          <span className="text-2xs text-muted tnum">
                            {formatSom(q.tolangan)} to&apos;langan
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted mb-2">
              Tarix ({qarzdor.hodisalar.length} ta yozuv)
            </p>
            <QarzdorTarix hodisalar={qarzdor.hodisalar} />
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="secondary"
              className="min-h-[44px]"
              onClick={() => onQarzQosh(qarzdor)}
            >
              + Qarz qo&apos;shish
            </Button>
            {qarzdor.ochiqQarzlar.length > 0 && (
              <Button className="min-h-[44px]" onClick={() => setTolovOchiq(true)}>
                {beriladigan ? "To'lov qilish" : "To'lov qabul qilish"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
