"use client";

import { useState, useMemo, FormEvent } from "react";
import { formatSom, parseSomInput } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import { Button } from "@/components/ui/Button";
import { TOLOV_TURLARI, TOLOV_NOMI, TOLOV_BELGI, type TolovTuri } from "@/lib/validation/transaction";
import { QarzForm, type QarzMasul } from "./QarzForm";
import type { TransactionDTO } from "@/lib/queries/transactions";

interface CategoryOption {
  id: string;
  nomi: string;
  turi: string;
}

interface AccountOption {
  id: string;
  nomi: string;
}

export function TransactionForm({
  categories,
  accounts,
  masullar = [],
  onCreated,
  onQarzCreated,
}: {
  categories: CategoryOption[];
  /** Faol kassalar. Bitta bo'lsa tanlash maydoni KO'RSATILMAYDI — ortiqcha qadam. */
  accounts: AccountOption[];
  /** Qarzga mas'ul qilib belgilash mumkin bo'lgan xodimlar. */
  masullar?: QarzMasul[];
  onCreated: (t: TransactionDTO) => void;
  /** Qarz yozilgach sahifani yangilash (qarz tranzaksiya emas). */
  onQarzCreated?: () => void;
}) {
  const [turi, setTuri] = useState<"kirim" | "chiqim">("kirim");
  const [tolovTuri, setTolovTuri] = useState<TolovTuri>("naqd");
  const [categoryId, setCategoryId] = useState("");
  const [summaText, setSummaText] = useState("");
  const [sana, setSana] = useState(todayDateOnlyString());
  const [izoh, setIzoh] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.turi === turi),
    [categories, turi]
  );

  function handleSummaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const numeric = parseSomInput(e.target.value);
    setSummaText(numeric ? formatSom(numeric) : "");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const summa = parseSomInput(summaText);
    const catId = categoryId || filteredCategories[0]?.id;
    if (!catId) {
      setError("Kategoriya tanlanmagan");
      return;
    }
    if (summa <= 0) {
      setError("Summani kiriting");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turi,
          tolovTuri,
          categoryId: catId,
          summa,
          sana,
          izoh: izoh || undefined,
          // Bitta kassali biznesda accountId yuborilmaydi — server birinchi
          // faol kassani o'zi tanlaydi.
          ...(accountId ? { accountId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        setLoading(false);
        return;
      }
      onCreated(data);
      setSummaText("");
      setIzoh("");
      setCategoryId("");
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  const qarzRejimi = tolovTuri === "qarz";

  return (
    // Tashqi element ATAYLAB `div`: qarz rejimida ichkarida QarzForm o'zining
    // `form`ini chiqaradi va forma ichida forma yaroqsiz HTML bo'lardi.
    <div className="bg-surface rounded-2xl shadow-sm border border-line p-5 space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setTuri("kirim");
            setCategoryId("");
          }}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            turi === "kirim" ? "bg-income text-white" : "bg-income-soft text-income-fg"
          }`}
        >
          Kirim
        </button>
        <button
          type="button"
          onClick={() => {
            setTuri("chiqim");
            setCategoryId("");
            // Qarz faqat kirim uchun — chiqimga o'tilganda naqdga qaytariladi.
            if (tolovTuri === "qarz") setTolovTuri("naqd");
          }}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            turi === "chiqim" ? "bg-expense text-white" : "bg-expense-soft text-expense-fg"
          }`}
        >
          Chiqim
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">To&apos;lov turi</label>
        <div className="grid grid-cols-3 gap-2">
          {TOLOV_TURLARI.filter((t) => t !== "qarz" || turi === "kirim").map((t) => (
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
              {TOLOV_BELGI[t]} {TOLOV_NOMI[t]}
            </button>
          ))}
        </div>
      </div>

      {/* QARZ — butunlay boshqa forma: tranzaksiya emas, majburiyat yoziladi.
          Shuning uchun kassa/summa maydonlari o'rniga mijoz formasi chiqadi. */}
      {qarzRejimi ? (
        <QarzForm
          kategoriyalar={filteredCategories}
          masullar={masullar}
          onCreated={() => onQarzCreated?.()}
        />
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Kategoriya</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          >
            <option value="">Tanlang...</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nomi}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Summa (so'm)</label>
          <input
            type="text"
            inputMode="numeric"
            value={summaText}
            onChange={handleSummaChange}
            placeholder="0"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Sana</label>
          <input
            type="date"
            value={sana}
            onChange={(e) => setSana(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        {accounts.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-muted mb-1" htmlFor="tx-kassa">
              Kassa
            </label>
            <select
              id="tx-kassa"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nomi}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Izoh (ixtiyoriy)</label>
          <input
            type="text"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-expense text-sm">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saqlanmoqda..." : "Qo'shish"}
      </Button>
      </form>
      )}
    </div>
  );
}
