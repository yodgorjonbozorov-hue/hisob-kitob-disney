"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { formatSom, parseSomInput } from "@/lib/format";

export interface ChiqimTanlov {
  id: string;
  nomi: string;
}

/**
 * TEZ CHIQIM — buyurtmalar sahifasidan chiqmasdan xarajat yozish.
 *
 * Yangi moliyaviy yo'l OCHILMAYDI: yozuv o'sha `/api/transactions` orqali
 * ketadi, ya'ni kassadan ayirish, kunlik hisobot va tasdiqlash qoidalari
 * Kirim/Chiqim sahifasidagi bilan bir xil ishlaydi.
 *
 * IKKI MARTA YUBORISHDAN HIMOYA: so'rov tugamaguncha tugma bloklanadi.
 */
export function ChiqimModal({
  kategoriyalar,
  kassalar,
  bugun,
  onClose,
  onSaqlandi,
}: {
  /** Chiqim turidagi faol kategoriyalar. */
  kategoriyalar: ChiqimTanlov[];
  /** Faol kassalar — NOMLAR, summasiz (kassa maxfiyligi). */
  kassalar: ChiqimTanlov[];
  bugun: string;
  onClose: () => void;
  /** `xabar` — foydalanuvchiga ko'rsatiladigan natija matni. */
  onSaqlandi: (xabar: string) => void;
}) {
  const [summaMatn, setSummaMatn] = useState("");
  const [categoryId, setCategoryId] = useState(kategoriyalar[0]?.id ?? "");
  const [izoh, setIzoh] = useState("");
  const [accountId, setAccountId] = useState(kassalar[0]?.id ?? "");
  const [sana, setSana] = useState(bugun);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const summa = parseSomInput(summaMatn);

  async function saqla() {
    if (loading) return;
    if (summa <= 0) return setXato("Summani kiriting");
    if (!categoryId) return setXato("Kategoriyani tanlang");
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turi: "chiqim",
          tolovTuri: "naqd",
          categoryId,
          summa,
          sana,
          izoh: izoh.trim() || undefined,
          // Kassa tanlanmagan bo'lsa (bitta ham kassa yo'q) — server o'zi tanlaydi.
          ...(accountId ? { accountId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      // TASDIQLASH moduli: chegaradan oshgan chiqim hali YOZILMAGAN (202).
      onSaqlandi(
        data.tasdiqKutilmoqda
          ? (data.message ?? "Tasdiq kutilmoqda")
          : `${formatSom(summa)} so'm chiqim yozildi`
      );
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Chiqim qilish">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saqla();
        }}
        className="space-y-3"
      >
        <div>
          <label className={LABEL_CLASS} htmlFor="crm-chiqim-summa">
            Summa
          </label>
          <input
            id="crm-chiqim-summa"
            inputMode="numeric"
            autoFocus
            value={summaMatn}
            onChange={(e) => setSummaMatn(e.target.value)}
            placeholder="0"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="crm-chiqim-kat">
            Kategoriya
          </label>
          {kategoriyalar.length === 0 ? (
            <p className="text-sm text-muted">
              Chiqim kategoriyasi yo&apos;q — avval Sozlamalar bo&apos;limida qo&apos;shing.
            </p>
          ) : (
            <Select
              id="crm-chiqim-kat"
              value={categoryId}
              onChange={setCategoryId}
              searchable={kategoriyalar.length > 7}
              options={kategoriyalar.map((k) => ({ value: k.id, label: k.nomi }))}
            />
          )}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="crm-chiqim-izoh">
            Izoh
          </label>
          <input
            id="crm-chiqim-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={500}
            placeholder="Masalan: benzin"
            className={INPUT_CLASS}
          />
        </div>

        {kassalar.length > 1 && (
          <div>
            <label className={LABEL_CLASS} htmlFor="crm-chiqim-kassa">
              Qaysi kassadan
            </label>
            <Select
              id="crm-chiqim-kassa"
              value={accountId}
              onChange={setAccountId}
              searchable={kassalar.length > 7}
              options={kassalar.map((k) => ({ value: k.id, label: k.nomi }))}
            />
          </div>
        )}

        <div>
          <label className={LABEL_CLASS} htmlFor="crm-chiqim-sana">
            Sana
          </label>
          <input
            id="crm-chiqim-sana"
            type="date"
            value={sana}
            onChange={(e) => setSana(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading} disabled={loading || kategoriyalar.length === 0}>
            Chiqimni saqlash
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
