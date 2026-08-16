"use client";

import { useState, FormEvent } from "react";
import { formatSom, parseSomInput } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import { Button } from "@/components/ui/Button";
import { MijozTanlash, type MijozTanlov } from "@/components/qarz/MijozTanlash";

export interface QarzKategoriya {
  id: string;
  nomi: string;
}

export interface QarzMasul {
  id: string;
  ism: string;
}

const BOSH_MIJOZ: MijozTanlov = { contactId: null, ism: "", tel: "" };

/**
 * QARZGA YOZISH FORMASI — Yozuvlar sahifasidagi "Kirim → Qarz".
 *
 * Oddiy kirim formasidan ATAYLAB farq qiladi: qarzda kassa tanlash yo'q
 * (pul hech qaysi kassaga tushmadi), o'rniga mijoz va telefon majburiy —
 * ularsiz qarzni keyin undirib bo'lmaydi.
 *
 * Yuborilgandan keyin BALANS O'ZGARMAYDI: yozuv `Debt` jadvaliga tushadi,
 * kirim tranzaksiyasi esa faqat mijoz to'laganda yoziladi.
 */
export function QarzForm({
  kategoriyalar,
  masullar,
  onCreated,
}: {
  kategoriyalar: QarzKategoriya[];
  masullar: QarzMasul[];
  /** Qarz yozilgach ro'yxat/ko'rsatkichlarni yangilash uchun. */
  onCreated: () => void;
}) {
  const [mijoz, setMijoz] = useState<MijozTanlov>(BOSH_MIJOZ);
  const [summaText, setSummaText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [masulId, setMasulId] = useState("");
  const [sana, setSana] = useState(todayDateOnlyString());
  const [muddat, setMuddat] = useState("");
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    // Klient tomonda ham tekshiriladi — server baribir qaytadan tekshiradi.
    const summa = parseSomInput(summaText);
    if (!mijoz.ism.trim()) {
      setError("Mijozni tanlang yoki ismini kiriting");
      return;
    }
    if (!mijoz.contactId && !mijoz.tel.trim()) {
      setError("Telefon raqamini kiriting");
      return;
    }
    if (summa <= 0) {
      setError("Qarz summasi 0 dan katta bo'lishi kerak");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turi: "olinadigan",
          contactId: mijoz.contactId,
          mijozNomi: mijoz.contactId ? undefined : mijoz.ism.trim(),
          mijozTel: mijoz.tel.trim() || undefined,
          jamiSumma: summa,
          sana,
          categoryId: categoryId || undefined,
          masulId: masulId || undefined,
          muddat: muddat || undefined,
          izoh: izoh.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setOk(`${formatSom(summa)} so'm qarz yozildi — balans o'zgarmadi`);
      setMijoz(BOSH_MIJOZ);
      setSummaText("");
      setIzoh("");
      setMuddat("");
      onCreated();
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-debt-soft border border-debt/20 px-3 py-2">
        <p className="text-xs text-debt-fg">
          Qarz — kirim emas. Bu yozuv naqd, Click va sof balansga TUSHMAYDI;
          pul faqat mijoz to&apos;laganda kirim bo&apos;lib yoziladi.
        </p>
      </div>

      <MijozTanlash qiymat={mijoz} onChange={setMijoz} disabled={loading} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1" htmlFor="qarz-summa">
            Qarz summasi (so&apos;m) <span className="text-expense">*</span>
          </label>
          <input
            id="qarz-summa"
            type="text"
            inputMode="numeric"
            value={summaText}
            onChange={(e) => {
              const n = parseSomInput(e.target.value);
              setSummaText(n ? formatSom(n) : "");
            }}
            placeholder="0"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1" htmlFor="qarz-kategoriya">
            Kategoriya
          </label>
          <select
            id="qarz-kategoriya"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
          >
            <option value="">Tanlang...</option>
            {kategoriyalar.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nomi}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1" htmlFor="qarz-sana">
            Sana
          </label>
          <input
            id="qarz-sana"
            type="date"
            value={sana}
            onChange={(e) => setSana(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1" htmlFor="qarz-muddat">
            To&apos;lov muddati (ixtiyoriy)
          </label>
          <input
            id="qarz-muddat"
            type="date"
            value={muddat}
            onChange={(e) => setMuddat(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        {masullar.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-muted mb-1" htmlFor="qarz-masul">
              Mas&apos;ul
            </label>
            <select
              id="qarz-masul"
              value={masulId}
              onChange={(e) => setMasulId(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
            >
              <option value="">Men</option>
              {masullar.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.ism}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-muted mb-1" htmlFor="qarz-izoh">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="qarz-izoh"
            type="text"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-expense text-sm">{error}</p>}
      {ok && <p className="text-income text-sm">{ok}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saqlanmoqda..." : "Qarzga yozish"}
      </Button>
    </form>
  );
}
