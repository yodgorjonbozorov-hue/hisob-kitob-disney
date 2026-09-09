"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSom, formatSomLabel, formatDateUZ } from "@/lib/format";
import { telKorinish, QARZ_TOLOV_NOMI, type QarzTolovUsuli } from "@/lib/validation/qarz";
import type { QarzTafsilotDTO } from "@/lib/queries/qarz";
import { QarzHolatBadge } from "./QarzHolatBadge";
import { QarzTolovForm, type KassaOption } from "./QarzTolovForm";
import { QarzTahrirForm } from "./QarzTahrirForm";
import { QarzOchirForm } from "./QarzOchirForm";
import { QarzBekorForm } from "./QarzBekorForm";

/**
 * QARZ TAFSILOTI — mijoz, summalar, to'lov tarixi va to'lov qabul qilish.
 *
 * Ma'lumot ochilganda serverdan qayta o'qiladi (ro'yxatdagi nusxadan emas):
 * boshqa xodim shu orada to'lov kiritgan bo'lishi mumkin va eskirgan
 * qoldiqqa qarab to'lov kiritish xato bo'lardi.
 */
export function QarzTafsilot({
  debtId,
  kassalar,
  bekorQilaOladi,
  qarzniBoshqaradi,
  onClose,
  onChanged,
}: {
  debtId: string;
  kassalar: KassaOption[];
  bekorQilaOladi: boolean;
  /** Direktor: qarzni tuzatish va o'chirish (6-talab). */
  qarzniBoshqaradi: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [qarz, setQarz] = useState<QarzTafsilotDTO | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [tolovOchiq, setTolovOchiq] = useState(false);
  const [bekorOchiq, setBekorOchiq] = useState(false);
  const [tahrirOchiq, setTahrirOchiq] = useState(false);
  const [ochirOchiq, setOchirOchiq] = useState(false);

  async function yukla() {
    setXato(null);
    try {
      const res = await fetch(`/api/debts/${debtId}`);
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Qarzni o'qib bo'lmadi");
        return;
      }
      setQarz(data);
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    }
  }

  useEffect(() => {
    void yukla();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtId]);

  const beriladigan = qarz?.turi === "beriladigan";

  return (
    <Modal open onClose={onClose} title={qarz ? qarz.mijozNomi : "Qarz tafsiloti"}>
      {xato && <p className="text-expense text-sm">{xato}</p>}
      {!qarz && !xato && <p className="text-faint text-sm">Yuklanmoqda...</p>}

      {qarz && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">
              {qarz.mijozTel ? telKorinish(qarz.mijozTel) : "telefon kiritilmagan"}
            </span>
            <QarzHolatBadge status={qarz.status} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Raqam label="Boshlang'ich qarz" qiymat={qarz.jamiSumma} cls="text-fg" />
            <Raqam label="To'langan" qiymat={qarz.tolangan} cls="text-income" />
            <Raqam label="Qolgan" qiymat={qarz.qolgan} cls="text-debt" />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <Qator k="Berilgan sana" v={formatDateUZ(new Date(qarz.sana))} />
            <Qator k="Muddat" v={qarz.muddat ? formatDateUZ(new Date(qarz.muddat)) : "—"} />
            <Qator k="Kategoriya" v={qarz.kategoriyaNomi ?? "—"} />
            <Qator k="Mas'ul" v={qarz.masulIsm ?? "—"} />
            <Qator k="Kim yaratdi" v={qarz.yaratgan ?? "—"} />
            <Qator k="Yaratilgan" v={formatDateUZ(new Date(qarz.createdAt))} />
            {qarz.productNomi && <Qator k="Mahsulot" v={qarz.productNomi} />}
            {qarz.izoh && <Qator k="Izoh" v={qarz.izoh} />}
            {qarz.cancelReason && <Qator k="Bekor sababi" v={qarz.cancelReason} />}
          </dl>

          <div>
            <p className="text-xs font-medium text-muted mb-2">
              Qarz tarixi ({qarz.tolovlar.length} ta to&apos;lov)
            </p>
            {qarz.tolovlar.length === 0 ? (
              <p className="text-xs text-faint">Hali to&apos;lov qabul qilinmagan.</p>
            ) : (
              <ul className="divide-y divide-line border border-line rounded-lg">
                {qarz.tolovlar.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-fg tnum">
                        {formatDateUZ(new Date(t.sana))}
                      </p>
                      <p className="text-2xs text-muted truncate">
                        {t.tolovTuri
                          ? QARZ_TOLOV_NOMI[t.tolovTuri as QarzTolovUsuli] ?? t.tolovTuri
                          : "usul ko'rsatilmagan"}
                        {t.kassaNomi ? ` · ${t.kassaNomi}` : ""}
                        {t.userIsm ? ` · ${t.userIsm}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-income tnum whitespace-nowrap">
                      + {formatSom(t.summa)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!qarz.isYopilgan && !tolovOchiq && !tahrirOchiq && !ochirOchiq && (
            <div className="flex flex-wrap gap-2 justify-end">
              {/* TUZATISH VA O'CHIRISH — faqat direktorda (6-talab).
                  Tugmani yashirish HIMOYA EMAS: server ham `requireManager`
                  va `qarz.tahrir` huquqini tekshiradi
                  (src/app/api/debts/[id]/route.ts). */}
              {qarzniBoshqaradi && (
                <Button variant="secondary" onClick={() => setTahrirOchiq(true)}>
                  Tuzatish
                </Button>
              )}
              {qarzniBoshqaradi && qarz.tolangan === 0 && (
                <Button variant="secondary" onClick={() => setOchirOchiq(true)}>
                  O&apos;chirish
                </Button>
              )}
              {bekorQilaOladi && qarz.tolangan === 0 && (
                <Button variant="secondary" onClick={() => setBekorOchiq(true)}>
                  Bekor qilish
                </Button>
              )}
              <Button onClick={() => setTolovOchiq(true)}>
                {beriladigan ? "To'lash" : "To'lov qilish"}
              </Button>
            </div>
          )}

          {/* YOPILGAN QARZ ham tuzatiladi — faqat direktor va faqat
              "Tuzatish". Sabab: 5 mln o'rniga 500 ming yozilgan qarz mijoz
              500 ming to'lagach YOPIQ bo'lib qoladi va aynan o'shanda
              to'g'irlash kerak. Summa oshirilsa holat MAVJUD qoida bilan
              qayta ochiladi (lib/validation/qarz.ts `qarzHolatHisobla`).
              Bekor qilingan qarz bundan tashqarida — u undirilmaydi. */}
          {qarz.isYopilgan && qarz.status !== "CANCELLED" && qarzniBoshqaradi && !tahrirOchiq && (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setTahrirOchiq(true)}>
                Tuzatish
              </Button>
            </div>
          )}

          {tahrirOchiq && (
            <QarzTahrirForm
              debtId={qarz.id}
              jamiSumma={qarz.jamiSumma}
              tolangan={qarz.tolangan}
              contactId={qarz.contactId}
              mijozNomi={qarz.mijozNomi}
              mijozTel={qarz.mijozTel}
              sana={qarz.sana.slice(0, 10)}
              muddat={qarz.muddat ? qarz.muddat.slice(0, 10) : ""}
              izoh={qarz.izoh ?? ""}
              onCancel={() => setTahrirOchiq(false)}
              onDone={async () => {
                setTahrirOchiq(false);
                await yukla();
                onChanged();
              }}
            />
          )}

          {ochirOchiq && (
            <QarzOchirForm
              debtId={qarz.id}
              onCancel={() => setOchirOchiq(false)}
              onDone={() => {
                setOchirOchiq(false);
                onChanged();
                onClose();
              }}
            />
          )}

          {tolovOchiq && (
            <QarzTolovForm
              debtId={qarz.id}
              qolgan={qarz.qolgan}
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

          {bekorOchiq && (
            <QarzBekorForm
              debtId={qarz.id}
              onCancel={() => setBekorOchiq(false)}
              onDone={async () => {
                setBekorOchiq(false);
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

function Raqam({ label, qiymat, cls }: { label: string; qiymat: number; cls: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-2xs text-muted">{label}</p>
      <p className={`text-sm font-semibold tnum ${cls}`}>{formatSomLabel(qiymat)}</p>
    </div>
  );
}

function Qator({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-faint">{k}</dt>
      <dd className="text-fg">{v}</dd>
    </>
  );
}
