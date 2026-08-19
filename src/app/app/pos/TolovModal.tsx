"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { formatSomLabel } from "@/lib/format";
import type { AccountDTO } from "@/lib/queries/accounts";
import type { MijozDTO } from "@/lib/queries/mijoz";

/**
 * TO'LOV OYNASI — savat yig'ilgach kassir shu yerda to'lovni yakunlaydi.
 *
 * To'lov usullari mavjud arxitekturadan olinadi: pul KASSAGA (Account)
 * tushadi, "naqd/karta/Click" esa o'sha kassaning turi. Yangi parallel
 * "to'lov usuli" modeli YARATILMAGAN.
 */

export type TolovTuri = "naqd" | "karta" | "click" | "qarz";

const USULLAR: Array<{ code: TolovTuri; label: string }> = [
  { code: "naqd", label: "Naqd" },
  { code: "karta", label: "Karta" },
  { code: "click", label: "Click" },
  { code: "qarz", label: "Qarz" },
];

export function TolovModal({
  jami,
  kassalar,
  mijozlar,
  yuborilmoqda,
  xato,
  onClose,
  onTasdiq,
}: {
  jami: number;
  kassalar: AccountDTO[];
  mijozlar: MijozDTO[];
  yuborilmoqda: boolean;
  xato: string | null;
  onClose: () => void;
  onTasdiq: (d: {
    tolovTuri: TolovTuri;
    accountId: string | null;
    contactId: string | null;
    mijozNomi: string | null;
    mijozTel: string | null;
  }) => void;
}) {
  const [tolovTuri, setTolovTuri] = useState<TolovTuri>("naqd");
  const [accountId, setAccountId] = useState<string>(kassalar[0]?.id ?? "");
  const [contactId, setContactId] = useState<string>("");
  const [mijozNomi, setMijozNomi] = useState("");
  const [mijozTel, setMijozTel] = useState("");
  // Naqd to'lovda kassir qaytimni sanashi kerak — eng ko'p uchraydigan xato joyi.
  const [olindi, setOlindi] = useState<string>("");

  const qarz = tolovTuri === "qarz";
  const tanlanganMijoz = useMemo(
    () => mijozlar.find((m) => m.id === contactId) ?? null,
    [mijozlar, contactId]
  );
  const qaytim = olindi ? Number(olindi) - jami : null;

  function tasdiqla() {
    onTasdiq({
      tolovTuri,
      accountId: qarz ? null : accountId || null,
      contactId: qarz && contactId ? contactId : null,
      mijozNomi: qarz ? (tanlanganMijoz?.ism ?? mijozNomi).trim() || null : null,
      mijozTel: qarz ? (tanlanganMijoz?.tel ?? mijozTel).trim() || null : null,
    });
  }

  const tasdiqMumkin = qarz ? !!(tanlanganMijoz?.ism ?? mijozNomi).trim() : true;

  return (
    <Modal open onClose={onClose} title="To'lov">
      <div className="space-y-4">
        <div className="rounded-2xl bg-surface-2 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-muted">To&apos;lanadi</span>
          <Money value={jami} size="xl" tone="brand" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">To&apos;lov usuli</label>
          <div className="grid grid-cols-4 gap-2">
            {USULLAR.map((u) => (
              <button
                key={u.code}
                onClick={() => setTolovTuri(u.code)}
                className={`rounded-xl border px-2 py-2 text-sm transition ${
                  tolovTuri === u.code
                    ? "border-brand bg-brand-wash text-brand font-medium"
                    : "border-line text-muted"
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {!qarz && kassalar.length > 0 && (
          <div>
            <label className="block text-xs text-muted mb-1">Pul qaysi kassaga tushadi</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
            >
              {kassalar.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nomi}
                  {k.egaIsm ? ` (${k.egaIsm})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {tolovTuri === "naqd" && (
          <div>
            <label className="block text-xs text-muted mb-1">Xaridordan olindi (ixtiyoriy)</label>
            <input
              type="number"
              inputMode="numeric"
              value={olindi}
              onChange={(e) => setOlindi(e.target.value)}
              placeholder="Masalan: 50000"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
            />
            {qaytim != null && Number.isFinite(qaytim) && (
              <p className={`text-sm mt-1 ${qaytim < 0 ? "text-expense" : "text-fg"}`}>
                {qaytim < 0
                  ? `Yetmayapti: ${formatSomLabel(-qaytim)}`
                  : `Qaytim: ${formatSomLabel(qaytim)}`}
              </p>
            )}
            <p className="text-xs text-faint mt-1">
              Bu maydon faqat qaytimni sanash uchun — hisobga yozilmaydi.
            </p>
          </div>
        )}

        {qarz && (
          <div className="space-y-2">
            {mijozlar.length > 0 && (
              <div>
                <label className="block text-xs text-muted mb-1">Mijoz kartochkasi</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
                >
                  <option value="">— tanlanmagan (ism qo&apos;lda) —</option>
                  {mijozlar.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ism}
                      {m.ochiqQarz > 0 ? ` — qarzi ${formatSomLabel(m.ochiqQarz)}` : ""}
                    </option>
                  ))}
                </select>
                {tanlanganMijoz?.qarzLimit != null && (
                  <p className="text-xs text-faint mt-1">
                    Qarz limiti: {formatSomLabel(tanlanganMijoz.qarzLimit)} · ochiq qarz:{" "}
                    {formatSomLabel(tanlanganMijoz.ochiqQarz)}
                  </p>
                )}
              </div>
            )}
            {!contactId && (
              <>
                <input
                  value={mijozNomi}
                  onChange={(e) => setMijozNomi(e.target.value)}
                  placeholder="Mijoz ismi (majburiy)"
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
                />
                <input
                  value={mijozTel}
                  onChange={(e) => setMijozTel(e.target.value)}
                  placeholder="Telefon (ixtiyoriy)"
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
                />
              </>
            )}
            <p className="text-xs text-faint">
              Qarzga sotuvda pul kassaga tushmaydi — daromad qarz to&apos;langanda yoziladi.
            </p>
          </div>
        )}

        {xato && (
          <p className="text-sm text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2">
            {xato}
          </p>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onClose} disabled={yuborilmoqda}>
            Bekor qilish
          </Button>
          <Button onClick={tasdiqla} loading={yuborilmoqda} disabled={!tasdiqMumkin}>
            Sotish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
