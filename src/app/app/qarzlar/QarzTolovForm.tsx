"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import {
  QARZ_TOLOV_USULLARI,
  QARZ_TOLOV_NOMI,
  QARZ_TOLOV_BELGI,
  type QarzTolovUsuli,
} from "@/lib/validation/qarz";

export interface KassaOption {
  id: string;
  nomi: string;
}

/**
 * Bir martalik kalit — takror to'lovdan himoyaning KLIENT tarafi.
 *
 * Kalit forma OCHILGANDA bir marta yaratiladi va yuborishda o'zgarmaydi:
 * shu bois tugma ikki marta bosilsa ham server ikkala so'rovda AYNI kalitni
 * ko'radi va ikkinchisiga mavjud to'lovni qaytaradi. Server tarafda esa
 * `@@unique([debtId, idempotencyKey])` poygani bazada hal qiladi.
 */
function yangiKalit(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return c.randomUUID();
  return `k-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export function QarzTolovForm({
  debtId,
  qolgan,
  beriladigan,
  kassalar,
  onCancel,
  onDone,
}: {
  debtId: string;
  qolgan: number;
  beriladigan: boolean;
  kassalar: KassaOption[];
  onCancel: () => void;
  onDone: () => void;
}) {
  // Summa ATAYLAB bo'sh boshlanadi: operator mijoz real bergan pulni o'zi
  // yozadi — qisman to'lovda oldindan to'ldirilgan jami summa xato
  // tasdiqlashga olib kelardi.
  const [summa, setSumma] = useState("");
  const [tolovTuri, setTolovTuri] = useState<QarzTolovUsuli>("naqd");
  const [accountId, setAccountId] = useState("");
  const [sana, setSana] = useState(todayDateOnlyString());
  const [izoh, setIzoh] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const kalit = useRef(yangiKalit());

  async function yubor() {
    if (loading) return;
    setXato(null);
    const s = parseSomInput(summa);
    if (s <= 0) {
      setXato("To'lov summasini kiriting");
      return;
    }
    if (s > qolgan) {
      setXato(`To'lov qolgan qarzdan (${formatSomLabel(qolgan)}) ko'p bo'lmasligi kerak`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/debts/${debtId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summa: s,
          sana,
          tolovTuri,
          accountId: accountId || undefined,
          izoh: izoh.trim() || undefined,
          idempotencyKey: kalit.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik");
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
    <div className="space-y-3 border-t border-line pt-3">
      <p className="text-sm text-muted">
        Qolgan qarz: <span className="font-medium text-debt">{formatSomLabel(qolgan)}</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="tolov-summa">
            To&apos;lov summasi (so&apos;m)
          </label>
          <input
            id="tolov-summa"
            type="text"
            inputMode="numeric"
            value={summa}
            onChange={(e) => {
              const n = parseSomInput(e.target.value);
              setSumma(n ? formatSom(n) : "");
            }}
            placeholder="To'lov summasini kiriting"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="tolov-sana">
            To&apos;lov sanasi
          </label>
          <input
            id="tolov-sana"
            type="date"
            value={sana}
            onChange={(e) => setSana(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <span className="block text-xs text-muted mb-1">To&apos;lov turi</span>
        <div className="grid grid-cols-3 gap-2">
          {QARZ_TOLOV_USULLARI.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTolovTuri(t)}
              className={`px-3 py-2 rounded-lg border text-sm transition ${
                tolovTuri === t
                  ? "border-brand bg-brand-wash text-brand font-medium"
                  : "border-line bg-surface-2 text-fg hover:border-brand"
              }`}
            >
              {QARZ_TOLOV_BELGI[t]} {QARZ_TOLOV_NOMI[t]}
            </button>
          ))}
        </div>
      </div>

      {kassalar.length > 1 && (
        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="tolov-kassa">
            Kassa
          </label>
          <Select
            id="tolov-kassa"
            value={accountId}
            onChange={setAccountId}
            searchable={kassalar.length > 7}
            options={[
              { value: "", label: "To'lov turiga mos kassa" },
              ...kassalar.map((k) => ({ value: k.id, label: k.nomi })),
            ]}
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-muted mb-1" htmlFor="tolov-izoh">
          Izoh (ixtiyoriy)
        </label>
        <input
          id="tolov-izoh"
          type="text"
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
      </div>

      <p className="text-2xs text-faint">
        {beriladigan
          ? "Chiqim yozuvi TO'LOV SANASI bilan yaratiladi."
          : "Kirim yozuvi TO'LOV SANASI bilan yaratiladi — qarz berilgan kun hisobotiga tushmaydi."}
      </p>

      {xato && <p className="text-expense text-sm">{xato}</p>}

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" type="button" onClick={onCancel} disabled={loading}>
          Bekor qilish
        </Button>
        <Button type="button" onClick={yubor} disabled={loading || parseSomInput(summa) <= 0}>
          {loading ? "..." : beriladigan ? "To'ladim" : "Qabul qilish"}
        </Button>
      </div>
    </div>
  );
}
