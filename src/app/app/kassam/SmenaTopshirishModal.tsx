"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { parseSomInput, formatMoney } from "@/lib/format";

export interface TopshirishNishoni {
  id: string;
  nomi: string;
  egaIsm: string | null;
}

/**
 * SMENANI TOPSHIRISH.
 *
 * Kassadagi TIZIM hisobi ko'rsatiladi va u o'zgartirilmaydi — xodim faqat
 * haqiqatda topshirayotgan summani kiritadi. Farq bo'lsa (kamomad/ortiqcha)
 * u darhol ko'rinadi va sabab so'raladi: nazoratning butun ma'nosi shunda.
 *
 * Topshiriq DARHOL yakunlanmaydi — qabul qiluvchi pulni sanab "Qabul qilish"ni
 * bosgunicha pul topshiruvchining kassasida qoladi.
 */
export function SmenaTopshirishModal({
  qoldiq,
  nishonlar,
  onClose,
  onDone,
}: {
  /** Tizim hisoblagan joriy kassa qoldig'i. */
  qoldiq: number;
  /** Kimga topshirish mumkin — boshqa faol kassalar. */
  nishonlar: TopshirishNishoni[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [toAccountId, setTo] = useState(nishonlar[0]?.id ?? "");
  const [summaMatn, setSummaMatn] = useState(String(qoldiq));
  const [izoh, setIzoh] = useState("");
  const [tasdiq, setTasdiq] = useState(false);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const summa = parseSomInput(summaMatn);
  const farq = summa - qoldiq;
  const nishon = nishonlar.find((n) => n.id === toAccountId);

  async function yubor() {
    // Ikki marta bosishdan himoya: birinchi so'rov tugamaguncha ikkinchisi ketmaydi
    // (server ham ochiq topshiriqni qayta tekshiradi).
    if (loading) return;
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kassa-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAccountId,
          summa,
          turi: "smena",
          izoh: izoh.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        setTasdiq(false);
        return;
      }
      toast({
        message:
          `Kassa muvaffaqiyatli topshirildi · Topshirildi: ${formatMoney(summa)} · ` +
          `Joriy kassa: ${formatMoney(Math.max(qoldiq - summa, 0))}`,
        tone: "success",
        duration: 7000,
      });
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
      setTasdiq(false);
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

  if (tasdiq) {
    return (
      <Modal open onClose={() => setTasdiq(false)} title="Smenani topshirasizmi?">
        <div className="space-y-4">
          <div className="rounded-xl bg-surface-2 border border-line p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Kimga</span>
              <span className="text-fg font-medium">{nishon?.egaIsm ?? nishon?.nomi}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Kassadagi hisob</span>
              <span className="text-fg tnum">{formatMoney(qoldiq)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Topshiriladigan</span>
              <span className="text-fg font-semibold tnum">{formatMoney(summa)}</span>
            </div>
            {farq !== 0 && (
              <div className="flex justify-between border-t border-line pt-2">
                <span className={farq < 0 ? "text-expense" : "text-debt"}>
                  {farq < 0 ? "Kamomad" : "Ortiqcha"}
                </span>
                <span className={`tnum font-semibold ${farq < 0 ? "text-expense" : "text-debt"}`}>
                  {farq > 0 ? "+" : "−"}
                  {Math.abs(farq).toLocaleString("ru-RU")}
                </span>
              </div>
            )}
          </div>
          <p className="text-2xs text-muted">
            {nishon?.egaIsm ?? "Qabul qiluvchi"} tasdiqlamaguncha pul sizning kassangizda qoladi.
          </p>
          {xato && <p className="text-sm text-expense">{xato}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTasdiq(false)}
              disabled={loading}
            >
              Orqaga
            </Button>
            <Button type="button" loading={loading} disabled={loading} onClick={yubor}>
              Topshirish
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Smenani topshirish">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTasdiq(true);
        }}
        className="space-y-3"
      >
        <div className="rounded-xl bg-surface-2 border border-line p-3 text-center">
          <p className="text-2xs text-muted">Kassangizdagi hisob</p>
          <p className="text-xl font-bold text-fg tnum">{formatMoney(qoldiq)}</p>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="sm-to">
            Kimga topshiriladi
          </label>
          <Select
            id="sm-to"
            value={toAccountId}
            onChange={setTo}
            searchable={nishonlar.length > 7}
            options={nishonlar.map((n) => ({ value: n.id, label: n.egaIsm ?? n.nomi }))}
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="sm-summa">
            Topshiriladigan summa
          </label>
          <input
            id="sm-summa"
            inputMode="numeric"
            value={summaMatn}
            onChange={(e) => setSummaMatn(e.target.value)}
            required
            className={input}
          />
          {farq !== 0 && summa > 0 && (
            <p className={`text-2xs mt-1 ${farq < 0 ? "text-expense" : "text-debt"}`}>
              Kassa farqi: {farq > 0 ? "+" : "−"}
              {Math.abs(farq).toLocaleString("ru-RU")} so&apos;m — sababini izohda yozing.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="sm-izoh">
            Izoh {farq !== 0 ? "(farq sababi)" : "(ixtiyoriy)"}
          </label>
          <input
            id="sm-izoh"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            maxLength={300}
            placeholder={farq !== 0 ? "Masalan: mijozga qaytim ortiqcha berildi" : "Kechki smena"}
            className={input}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={summa <= 0 || !toAccountId || (farq !== 0 && !izoh.trim())}>
            Davom etish
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
