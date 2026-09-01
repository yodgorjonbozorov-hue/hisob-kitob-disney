"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Select } from "@/components/ui/Select";
import { formatSomLabel } from "@/lib/format";
import type { AccountDTO } from "@/lib/queries/accounts";
import { MijozTanlash, type MijozTanlov } from "@/components/qarz/MijozTanlash";

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

const BOSH_MIJOZ: MijozTanlov = { contactId: null, ism: "", tel: "" };

export function TolovModal({
  jami,
  kassalar,
  yuborilmoqda,
  xato,
  onClose,
  onTasdiq,
}: {
  jami: number;
  kassalar: AccountDTO[];
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
  const [mijoz, setMijoz] = useState<MijozTanlov>(BOSH_MIJOZ);
  // Naqd to'lovda kassir qaytimni sanashi kerak — eng ko'p uchraydigan xato joyi.
  const [olindi, setOlindi] = useState<string>("");

  const qarz = tolovTuri === "qarz";
  const qaytim = olindi ? Number(olindi) - jami : null;

  function tasdiqla() {
    onTasdiq({
      tolovTuri,
      accountId: qarz ? null : accountId || null,
      contactId: qarz ? mijoz.contactId : null,
      mijozNomi: qarz ? mijoz.ism.trim() || null : null,
      mijozTel: qarz ? mijoz.tel.trim() || null : null,
    });
  }

  const tasdiqMumkin = qarz ? !!mijoz.ism.trim() : true;

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
            <label className="block text-xs text-muted mb-1" htmlFor="pos-kassa">
              Pul qaysi kassaga tushadi
            </label>
            <Select
              id="pos-kassa"
              value={accountId}
              onChange={setAccountId}
              searchable={kassalar.length > 7}
              options={kassalar.map((k) => ({
                value: k.id,
                label: k.nomi,
                tavsif: k.egaIsm ?? undefined,
              }))}
            />
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
            {/* Mijoz tanlash — qarzlar sahifasi bilan AYNI komponent.
                Kassir mavjud mijozni topib tanlaydi (joriy qarzi ko'rinadi)
                yoki "+ Yangi mijoz" bilan kartochka ochadi. Ism qo'lda
                yozilganda ham server kartochkani o'zi topadi/yaratadi
                (lib/services/mijozAniqla.ts) — bir mijoz bitta qarzdor. */}
            <MijozTanlash
              qiymat={mijoz}
              onChange={setMijoz}
              disabled={yuborilmoqda}
              yangiSumma={jami}
            />
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
