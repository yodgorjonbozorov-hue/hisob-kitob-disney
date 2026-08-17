"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSom, formatSomLabel, formatDateUz } from "@/lib/format";
import { telKorinish } from "@/lib/validation/qarz";
import type { QarzdorTafsilotDTO } from "@/lib/queries/qarz";
import { QarzdorTarix } from "./QarzdorTarix";
import { QarzTolovForm, type KassaOption } from "./QarzTolovForm";

/**
 * QARZDOR TAFSILOTI — bitta shaxsning butun hisob-kitobi.
 *
 * Ma'lumot ochilganda serverdan QAYTA o'qiladi (ro'yxatdagi nusxadan emas):
 * boshqa xodim shu orada to'lov kiritgan bo'lishi mumkin.
 *
 * TO'LOV QAYSI QARZGA YOZILADI: to'lov har doim ANIQ bitta `Debt` yozuviga
 * biriktiriladi — shu bois qarzdorda bir nechta ochiq qarz bo'lsa, forma
 * ustida tanlov chiqadi (birinchi bo'lib eng eskisi taklif qilinadi).
 * Avtomatik taqsimlash ataylab yo'q: qaysi qarz yopilgani buxgalteriya
 * qarori, dastur uni o'zi hal qilib qo'ymasligi kerak.
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
  const [tanlanganQarz, setTanlanganQarz] = useState<string>("");

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
      // Eng eski ochiq qarz — odatda birinchi yopiladigan qarz.
      setTanlanganQarz(data.ochiqQarzlar[0]?.id ?? "");
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    }
  }, [kalit, turi]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  const beriladigan = turi === "beriladigan";
  const joriy = qarzdor?.ochiqQarzlar.find((q) => q.id === tanlanganQarz) ?? null;

  return (
    <Modal open onClose={onClose} title={qarzdor ? qarzdor.ism : "Qarzdor"}>
      {xato && <p className="text-expense text-sm">{xato}</p>}
      {!qarzdor && !xato && <p className="text-faint text-sm">Yuklanmoqda...</p>}

      {qarzdor && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {qarzdor.tel ? telKorinish(qarzdor.tel) : "telefon kiritilmagan"}
          </p>

          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <p className="text-xs text-muted">
              {beriladigan ? "Joriy qarzim" : "Joriy qarz"}
            </p>
            <p className="text-2xl font-bold tnum text-debt">
              {formatSomLabel(qarzdor.jamiQarz)}
            </p>
            <p className="text-2xs text-faint mt-0.5 tnum">
              Jami olingan {formatSom(qarzdor.jamiBerilgan)} · to&apos;langan{" "}
              {formatSom(qarzdor.jamiTolangan)}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted mb-2">
              Tarix ({qarzdor.hodisalar.length} ta yozuv)
            </p>
            <QarzdorTarix hodisalar={qarzdor.hodisalar} />
          </div>

          {!tolovOchiq && (
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="secondary" onClick={() => onQarzQosh(qarzdor)}>
                + Qarz qo&apos;shish
              </Button>
              {qarzdor.ochiqQarzlar.length > 0 && (
                <Button onClick={() => setTolovOchiq(true)}>
                  {beriladigan ? "+ To'lov qilish" : "+ To'lov qabul qilish"}
                </Button>
              )}
            </div>
          )}

          {tolovOchiq && qarzdor.ochiqQarzlar.length > 1 && (
            <div className="border-t border-line pt-3">
              <label className="block text-xs text-muted mb-1" htmlFor="qarzdor-qaysi-qarz">
                Qaysi qarzga yoziladi
              </label>
              <select
                id="qarzdor-qaysi-qarz"
                value={tanlanganQarz}
                onChange={(e) => setTanlanganQarz(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
              >
                {qarzdor.ochiqQarzlar.map((q) => (
                  <option key={q.id} value={q.id}>
                    {formatDateUz(new Date(q.sana))} · qolgan {formatSom(q.qolgan)}
                    {q.izoh ? ` · ${q.izoh}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tolovOchiq && joriy && (
            <QarzTolovForm
              key={joriy.id}
              debtId={joriy.id}
              qolgan={joriy.qolgan}
              beriladigan={beriladigan}
              kassalar={kassalar}
              onCancel={() => setTolovOchiq(false)}
              onDone={async () => {
                setTolovOchiq(false);
                await yukla();
                onChanged();
              }}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
