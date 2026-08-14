"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { parseSomInput, formatMoney } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import type { OrderDTO } from "@/lib/queries/xarid";

/**
 * XARIDNI QABUL QILISH — to'lov bilan birga.
 *
 * To'langan summa jami xariddan kam bo'lsa, qolgani ta'minotchiga QARZ
 * sifatida ochiladi (keyin Qarzlar bo'limida bo'lib-bo'lib to'lanadi).
 * Ta'minotchi tizim foydalanuvchisiga bog'langan bo'lsa, to'lov chiqim emas —
 * uning shaxsiy kassasiga o'tkazma bo'lib tushadi.
 */
export function QabulModal({
  order,
  onClose,
  onDone,
}: {
  order: OrderDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [summaMatn, setSummaMatn] = useState(
    order.tolovTuri === "naqd" ? String(order.jamiSumma) : "0"
  );
  const [qabulSana, setQabulSana] = useState(todayDateOnlyString());
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const tolangan = parseSomInput(summaMatn);
  const qarz = Math.max(0, order.jamiSumma - tolangan);
  const notogri = tolangan < 0 || tolangan > order.jamiSumma;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/xarid/orders/${order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holat: "qabul_qilingan", qabulSana, tolanganSumma: tolangan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

  return (
    <Modal open onClose={onClose} title={`Qabul qilish: ${order.supplierNomi}`}>
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Jami xarid</span>
            <span className="font-semibold tnum text-fg">{formatMoney(order.jamiSumma)}</span>
          </div>
          {order.satrlar.map((s) => (
            <p key={s.productId} className="text-2xs text-faint mt-1">
              {s.productNomi}: {s.miqdor.toLocaleString("uz-UZ")} {s.birlik} ×{" "}
              {s.birlikNarx.toLocaleString("uz-UZ")} so&apos;m = {s.jamiSumma.toLocaleString("uz-UZ")} so&apos;m
            </p>
          ))}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="qb-summa">
            Hozir to&apos;lanadigan summa
          </label>
          <input
            id="qb-summa"
            inputMode="numeric"
            value={summaMatn}
            onChange={(e) => setSummaMatn(e.target.value)}
            className={input}
          />
          {notogri && (
            <p className="text-2xs text-debt mt-1">Summa 0 va jami xarid oralig&apos;ida bo&apos;lsin.</p>
          )}
          <div className="mt-2 flex gap-2">
            <button type="button" className="text-2xs text-brand" onClick={() => setSummaMatn(String(order.jamiSumma))}>
              To&apos;liq to&apos;lash
            </button>
            <button type="button" className="text-2xs text-brand" onClick={() => setSummaMatn("0")}>
              Hammasi qarzga
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-line p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted">To&apos;lanadi</span>
            <span className="tnum text-fg">{formatMoney(tolangan)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Qarzga qoladi</span>
            <span className={`tnum ${qarz > 0 ? "text-debt font-medium" : "text-fg"}`}>{formatMoney(qarz)}</span>
          </div>
          {order.supplierUserId && tolangan > 0 && (
            <p className="text-2xs text-faint pt-1">
              Ta&apos;minotchi tizim foydalanuvchisi — to&apos;lov uning shaxsiy kassasiga o&apos;tkazma
              bo&apos;lib tushadi (chiqim emas).
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="qb-sana">
            Qabul sanasi
          </label>
          <input
            id="qb-sana"
            type="date"
            value={qabulSana}
            onChange={(e) => setQabulSana(e.target.value)}
            required
            className={input}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading} disabled={notogri}>
            Qabul qilish
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
