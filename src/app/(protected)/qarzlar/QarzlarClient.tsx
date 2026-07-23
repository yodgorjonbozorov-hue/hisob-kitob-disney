"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatSom, formatSomLabel, parseSomInput, formatDateUZ } from "@/lib/format";
import type { DebtDTO } from "@/lib/queries/inventory";

export function QarzlarClient({ initialDebts }: { initialDebts: DebtDTO[] }) {
  const router = useRouter();
  const [debts, setDebts] = useState(initialDebts);
  const [payFor, setPayFor] = useState<DebtDTO | null>(null);

  const jamiQolgan = debts.filter((d) => !d.isYopilgan).reduce((a, d) => a + d.qolgan, 0);

  function onPaid(debtId: string, tolangan: number, qolgan: number, isYopilgan: boolean) {
    setDebts((prev) =>
      prev.map((d) => (d.id === debtId ? { ...d, tolangan, qolgan, isYopilgan } : d))
    );
    setPayFor(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-slate-500 text-sm mb-1">Jami qolgan qarz</p>
        <p className="text-2xl font-bold text-amber-600">{formatSomLabel(jamiQolgan)}</p>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 text-xs uppercase">
                <th className="pb-2">Mijoz</th>
                <th className="pb-2">Telefon</th>
                <th className="pb-2 text-right">Jami</th>
                <th className="pb-2 text-right">To'langan</th>
                <th className="pb-2 text-right">Qolgan</th>
                <th className="pb-2">Sana</th>
                <th className="pb-2 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {debts.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-6">
                    Qarzdorlik yo'q
                  </td>
                </tr>
              )}
              {debts.map((d) => (
                <tr key={d.id} className={d.isYopilgan ? "opacity-50" : ""}>
                  <td className="py-2.5 font-medium">{d.mijozNomi}</td>
                  <td className="py-2.5 text-slate-500">{d.mijozTel ?? "—"}</td>
                  <td className="py-2.5 text-right">{formatSomLabel(d.jamiSumma)}</td>
                  <td className="py-2.5 text-right text-emerald-600">{formatSom(d.tolangan)}</td>
                  <td className="py-2.5 text-right font-medium text-amber-600">{formatSom(d.qolgan)}</td>
                  <td className="py-2.5 text-slate-500 whitespace-nowrap">{formatDateUZ(new Date(d.sana))}</td>
                  <td className="py-2.5 text-right">
                    {d.isYopilgan ? (
                      <Badge tone="kirim">Yopilgan</Badge>
                    ) : (
                      <button
                        onClick={() => setPayFor(d)}
                        className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        To'lov qabul qilish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {payFor && <PaymentModal debt={payFor} onClose={() => setPayFor(null)} onPaid={onPaid} />}
    </div>
  );
}

function PaymentModal({
  debt,
  onClose,
  onPaid,
}: {
  debt: DebtDTO;
  onClose: () => void;
  onPaid: (debtId: string, tolangan: number, qolgan: number, isYopilgan: boolean) => void;
}) {
  const [summa, setSumma] = useState(formatSom(debt.qolgan));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const s = parseSomInput(summa);
    if (s <= 0) {
      setError("Summani kiriting");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/debts/${debt.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summa: s }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Xatolik");
      setLoading(false);
      return;
    }
    onPaid(debt.id, data.tolangan, data.qolgan, data.isYopilgan);
  }

  return (
    <Modal open onClose={onClose} title={`To'lov: ${debt.mijozNomi}`}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-500">
          Qolgan qarz: <span className="font-medium text-amber-600">{formatSomLabel(debt.qolgan)}</span>
        </p>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To'lov summasi (so'm)</label>
          <input
            type="text"
            inputMode="numeric"
            value={summa}
            onChange={(e) => setSumma(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            autoFocus
          />
        </div>
        {error && <p className="text-rose-600 text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Qabul qilish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
