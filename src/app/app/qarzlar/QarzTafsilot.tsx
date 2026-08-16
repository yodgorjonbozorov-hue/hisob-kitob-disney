"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSom, formatSomLabel, formatDateUZ } from "@/lib/format";
import { telKorinish, QARZ_TOLOV_NOMI, type QarzTolovUsuli } from "@/lib/validation/qarz";
import type { QarzTafsilotDTO } from "@/lib/queries/qarz";
import { QarzHolatBadge } from "./QarzHolatBadge";
import { QarzTolovForm, type KassaOption } from "./QarzTolovForm";

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
  onClose,
  onChanged,
}: {
  debtId: string;
  kassalar: KassaOption[];
  bekorQilaOladi: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [qarz, setQarz] = useState<QarzTafsilotDTO | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [tolovOchiq, setTolovOchiq] = useState(false);
  const [bekorOchiq, setBekorOchiq] = useState(false);

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

          {!qarz.isYopilgan && !tolovOchiq && (
            <div className="flex flex-wrap gap-2 justify-end">
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
            <BekorForm
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

function BekorForm({
  debtId,
  onCancel,
  onDone,
}: {
  debtId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [sabab, setSabab] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function yubor() {
    setXato(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/debts/${debtId}/bekor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sabab }),
      });
      if (!res.ok) {
        setXato((await res.json()).error ?? "Xatolik");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <label className="block text-xs text-muted" htmlFor="qarz-bekor-sabab">
        Bekor qilish sababi
      </label>
      <input
        id="qarz-bekor-sabab"
        type="text"
        value={sabab}
        onChange={(e) => setSabab(e.target.value)}
        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        autoFocus
      />
      <p className="text-2xs text-faint">
        Yozuv o&apos;chirilmaydi — kim, qachon va nega bekor qilgani saqlanadi.
      </p>
      {xato && <p className="text-expense text-sm">{xato}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Yopish
        </Button>
        <Button type="button" onClick={yubor} disabled={loading || sabab.trim().length < 3}>
          {loading ? "..." : "Bekor qilish"}
        </Button>
      </div>
    </div>
  );
}
