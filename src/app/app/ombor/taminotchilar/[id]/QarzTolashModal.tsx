"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import type { AccountDTO } from "@/lib/queries/accounts";
import type { TaminotchiProfilDTO } from "@/lib/queries/taminotchi";

/** Kassa turidan to'lov usulini chiqaradi (qarz to'lovi sxemasidagi qiymatlar). */
function usulKassadan(turi: string | undefined): "naqd" | "click" | "bank" {
  if (turi === "plastik") return "click";
  if (turi === "bank") return "bank";
  return "naqd";
}

/**
 * TA'MINOTCHI QARZINI TO'LASH — qisman yoki to'liq.
 *
 * Yangi backend YO'Q: bu forma mavjud "Men qarzdorman" to'lov oqimini
 * (`/api/debts/qarzdor/tolov`) chaqiradi. Ta'minotchining bir nechta ochiq
 * qarzi bo'lsa summa ENG ESKISIDAN boshlab taqsimlanadi — qoida bitta joyda
 * (`lib/services/qarz.ts`) va bu yerda takrorlanmaydi.
 *
 * Takror bosishdan himoya: oyna ochilganda BIR MARTA yaratiladigan
 * idempotentlik kaliti + `loading` tugma.
 */
export function QarzTolashModal({
  profil,
  kassalar,
  onClose,
  onDone,
}: {
  profil: TaminotchiProfilDTO;
  kassalar: AccountDTO[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [summa, setSumma] = useState(formatSom(profil.qolganQarz));
  const [accountId, setAccountId] = useState(kassalar[0]?.id ?? "");
  const [sana, setSana] = useState(todayDateOnlyString());
  const [izoh, setIzoh] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [yuborilmoqda, setYuborilmoqda] = useState(false);
  const idempotencyKey = useRef(`qt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

  const raqam = parseSomInput(summa);
  const yaroqli = raqam > 0 && raqam <= profil.qolganQarz && Boolean(accountId);

  async function yubor() {
    if (!yaroqli || yuborilmoqda) return;
    setXato(null);
    setYuborilmoqda(true);
    try {
      const res = await fetch("/api/debts/qarzdor/tolov", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turi: "beriladigan",
          kalit: profil.qarzKalit,
          summa: raqam,
          sana,
          tolovTuri: usulKassadan(kassalar.find((k) => k.id === accountId)?.turi),
          accountId,
          izoh: izoh.trim() || null,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setXato(data.error ?? "To'lovni saqlab bo'lmadi");
        return;
      }
      toast({ message: `${formatSomLabel(raqam)} to'landi`, tone: "success" });
      onDone();
    } catch {
      setXato("Tarmoq xatosi — qayta urinib ko'ring");
    } finally {
      setYuborilmoqda(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Qarz to'lash · ${profil.nomi}`}>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Qolgan qarz:{" "}
          <span className="font-semibold text-debt">{formatSomLabel(profil.qolganQarz)}</span>
        </p>

        <div>
          <label className={LABEL_CLASS} htmlFor="qt-summa">
            To&apos;lov summasi
          </label>
          <input
            id="qt-summa"
            inputMode="numeric"
            value={summa}
            onChange={(e) => setSumma(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
            className={INPUT_CLASS}
            autoFocus
          />
          {raqam > profil.qolganQarz && (
            <p className="text-2xs text-expense mt-1">Qarzdan ko&apos;p to&apos;lab bo&apos;lmaydi</p>
          )}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="qt-kassa">
            Qaysi kassadan
          </label>
          <Select
            id="qt-kassa"
            value={accountId}
            onChange={setAccountId}
            searchable={kassalar.length > 7}
            options={kassalar.map((k) => ({ value: k.id, label: k.nomi }))}
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="qt-sana">
            Sana
          </label>
          <input
            id="qt-sana"
            type="date"
            value={sana}
            onChange={(e) => setSana(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="qt-izoh">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="qt-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            placeholder="Masalan: avans"
            maxLength={500}
            className={INPUT_CLASS}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Bekor
          </Button>
          <Button
            size="lg"
            disabled={!yaroqli}
            loading={yuborilmoqda}
            onClick={() => void yubor()}
            className="flex-[2]"
          >
            To&apos;lovni saqlash
          </Button>
        </div>
      </div>
    </Modal>
  );
}
