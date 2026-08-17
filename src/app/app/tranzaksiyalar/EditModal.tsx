"use client";

import { useState } from "react";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TOLOV_TURLARI, TOLOV_NOMI, TOLOV_BELGI, type TolovTuri } from "@/lib/validation/transaction";
import { formatKg, kgSumma, kgToGram, parseKgInput } from "@/lib/kg";
import type { TransactionDTO } from "@/lib/queries/transactions";
import type { CategoryOption } from "./turlar";

/**
 * Yozuvni tahrirlash oynasi. Alohida faylda: `TransactionList` 250 satr
 * chegarasidan oshib ketmasligi kerak (CLAUDE.md kod qoidalari).
 *
 * KG SAVDOSI yozuvida (mijozga xos — Fortex Selos) summa maydoni YO'Q:
 * miqdor va 1 kg narxi tuzatiladi, jami ikkalasidan qayta hisoblanadi
 * (server ham shunday qiladi — lib/kg.ts).
 */
export function EditModal({
  transaction,
  categories,
  canDelete,
  onClose,
  onSaved,
  onDelete,
}: {
  transaction: TransactionDTO;
  categories: CategoryOption[];
  canDelete: boolean;
  onClose: () => void;
  onSaved: (t: TransactionDTO) => void;
  onDelete: () => void;
}) {
  const [turi, setTuri] = useState<"kirim" | "chiqim">(transaction.turi as "kirim" | "chiqim");
  // Eski yozuvda tolovTuri null — kassa turidan boshlang'ich qiymat chiqariladi.
  const [tolovTuri, setTolovTuri] = useState<TolovTuri>(
    (transaction.tolovTuri as TolovTuri | null) ??
      (transaction.account?.turi === "plastik" || transaction.account?.turi === "bank"
        ? "click"
        : "naqd")
  );
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [summaText, setSummaText] = useState(formatSom(transaction.summa));
  const [sana, setSana] = useState(new Date(transaction.sana).toISOString().slice(0, 10));
  const [izoh, setIzoh] = useState(transaction.izoh ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // KG SAVDOSI yozuvi (mijozga xos): summa QO'LDA tahrirlanmaydi — miqdor va
  // 1 kg narxi tuzatiladi, jami shundan qayta hisoblanadi (server ham).
  const kgYozuvi = transaction.miqdorGr != null && transaction.kgNarxi != null;
  const [miqdorText, setMiqdorText] = useState(kgYozuvi ? formatKg(transaction.miqdorGr!) : "");
  const [kgNarxText, setKgNarxText] = useState(kgYozuvi ? formatSom(transaction.kgNarxi!) : "");
  const miqdorKg = parseKgInput(miqdorText);
  const kgNarxi = parseSomInput(kgNarxText);
  const kgJami = miqdorKg > 0 && kgNarxi > 0 ? kgSumma(kgToGram(miqdorKg), kgNarxi) : 0;

  // Kg yozuvi kirim bo'lib qoladi va faqat kg kategoriyalari orasida ko'chadi.
  const filteredCategories = kgYozuvi
    ? categories.filter((c) => c.kgAsosli)
    : categories.filter((c) => c.turi === turi);

  async function handleSave() {
    setError(null);
    if (kgYozuvi) {
      if (miqdorKg <= 0) return setError("Miqdorni (kg) kiriting");
      if (kgNarxi <= 0) return setError("1 kg narxini kiriting");
    }
    const summa = parseSomInput(summaText);
    if (!kgYozuvi && summa <= 0) {
      setError("Summani kiriting");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kgYozuvi
            ? { tolovTuri, categoryId, sana, izoh: izoh || undefined, miqdorKg, kgNarxi }
            : { turi, tolovTuri, categoryId, summa, sana, izoh: izoh || undefined }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        setLoading(false);
        return;
      }
      onSaved(data);
    } catch {
      setError("Serverga ulanib bo'lmadi");
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tranzaksiyani tahrirlash">
      <div className="space-y-3">
        {/* Kg savdosida kirim/chiqim tanlovi YO'Q: sotuv har doim kirim. */}
        <div className={`flex gap-2 ${kgYozuvi ? "hidden" : ""}`}>
          <button
            onClick={() => {
              setTuri("kirim");
              setCategoryId("");
            }}
            className={`flex-1 py-1.5 rounded-lg text-sm ${turi === "kirim" ? "bg-income text-white" : "bg-income-soft text-income-fg"}`}
          >
            Kirim
          </button>
          <button
            onClick={() => {
              setTuri("chiqim");
              setCategoryId("");
              // Qarz faqat kirim uchun — chiqimga o'tilganda naqdga qaytariladi.
              if (tolovTuri === "qarz") setTolovTuri("naqd");
            }}
            className={`flex-1 py-1.5 rounded-lg text-sm ${turi === "chiqim" ? "bg-expense text-white" : "bg-expense-soft text-expense-fg"}`}
          >
            Chiqim
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TOLOV_TURLARI.filter((t) => t !== "qarz" || turi === "kirim").map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTolovTuri(t)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                tolovTuri === t
                  ? "border-brand bg-brand-wash text-brand font-medium"
                  : "border-line bg-surface-2 text-fg hover:border-brand"
              }`}
            >
              {TOLOV_BELGI[t]} {TOLOV_NOMI[t]}
            </button>
          ))}
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        >
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nomi}
            </option>
          ))}
        </select>
        {kgYozuvi ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-2xs text-muted">Miqdor (kg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={miqdorText}
                  onChange={(e) => setMiqdorText(e.target.value.replace(/[^\d.,]/g, ""))}
                  className="mt-0.5 w-full rounded-lg border border-line px-3 py-2 text-sm tnum"
                />
              </label>
              <label className="block">
                <span className="text-2xs text-muted">1 kg narxi</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={kgNarxText}
                  onChange={(e) => setKgNarxText(formatSom(parseSomInput(e.target.value)))}
                  className="mt-0.5 w-full rounded-lg border border-line px-3 py-2 text-sm tnum"
                />
              </label>
            </div>
            <p className="text-sm text-muted tnum">
              Jami: <span className="font-medium text-income">{formatSomLabel(kgJami)}</span>
            </p>
          </div>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            value={summaText}
            onChange={(e) => setSummaText(formatSom(parseSomInput(e.target.value)))}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        )}
        <input
          type="date"
          value={sana}
          onChange={(e) => setSana(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          placeholder="Izoh"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 items-center pt-2">
          {canDelete && (
            <Button variant="danger" onClick={onDelete} type="button">
              O'chirish
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" onClick={onClose} type="button">
              Bekor qilish
            </Button>
            <Button onClick={handleSave} loading={loading} type="button">
              Saqlash
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
