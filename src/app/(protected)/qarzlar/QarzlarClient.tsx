"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatSom, formatSomLabel, parseSomInput, formatDateUZ, formatMoneyCompact } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import type { DebtDTO } from "@/lib/queries/inventory";

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
/** Aging guruhi: 0-30 / 31-60 / 61-90 / 90+ */
function bucketOf(days: number): 0 | 1 | 2 | 3 {
  if (days <= 30) return 0;
  if (days <= 60) return 1;
  if (days <= 90) return 2;
  return 3;
}
const BUCKET_META = [
  { label: "0–30 kun", cls: "text-income" },
  { label: "31–60 kun", cls: "text-debt dark:text-debt-fg" },
  { label: "61–90 kun", cls: "text-orange-600 dark:text-orange-400" },
  { label: "90+ kun", cls: "text-expense" },
];

export function QarzlarClient({ initialDebts }: { initialDebts: DebtDTO[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [debts, setDebts] = useState(initialDebts);
  const [payFor, setPayFor] = useState<DebtDTO | null>(null);

  const ochiq = debts.filter((d) => !d.isYopilgan);
  const jamiQolgan = ochiq.reduce((a, d) => a + d.qolgan, 0);

  // Aging guruhlari bo'yicha qolgan summa.
  const buckets = [0, 0, 0, 0];
  ochiq.forEach((d) => (buckets[bucketOf(daysSince(d.sana))] += d.qolgan));

  // Ochiq qarzlar eng eski (ko'p kun) birinchi; yopilganlar oxirida.
  const sorted = [...debts].sort((a, b) => {
    if (a.isYopilgan !== b.isYopilgan) return a.isYopilgan ? 1 : -1;
    return new Date(a.sana).getTime() - new Date(b.sana).getTime();
  });

  function reminder(d: DebtDTO) {
    const text = `Assalomu alaykum, ${d.mijozNomi}. Sizning ${formatSomLabel(d.qolgan)} miqdoridagi qarzingiz eslatib o'tamiz. Iltimos, imkoniyat bo'lganda to'lab qo'ysangiz. Rahmat.`;
    navigator.clipboard?.writeText(text).then(
      () => toast({ message: "Eslatma matni nusxalandi", tone: "success" }),
      () => toast({ message: text, tone: "neutral", duration: 8000 })
    );
  }

  function onPaid(debtId: string, tolangan: number, qolgan: number, isYopilgan: boolean) {
    setDebts((prev) =>
      prev.map((d) => (d.id === debtId ? { ...d, tolangan, qolgan, isYopilgan } : d))
    );
    setPayFor(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-surface rounded-2xl shadow-card border border-line p-4 col-span-2 lg:col-span-1">
          <p className="text-muted text-sm mb-1">Jami qolgan</p>
          <p className="text-xl font-semibold text-debt tnum">{formatSomLabel(jamiQolgan)}</p>
        </div>
        {BUCKET_META.map((b, i) => (
          <div key={i} className="bg-surface rounded-2xl shadow-card border border-line p-4">
            <p className="text-muted text-sm mb-1">{b.label}</p>
            <p className={`text-lg font-semibold tnum ${b.cls}`}>{formatMoneyCompact(buckets[i])}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-faint text-xs uppercase">
                <th className="pb-2">Mijoz</th>
                <th className="pb-2">Telefon</th>
                <th className="pb-2 text-right">Jami</th>
                <th className="pb-2 text-right">To'langan</th>
                <th className="pb-2 text-right">Qolgan</th>
                <th className="pb-2">Sana</th>
                <th className="pb-2 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {debts.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-faint py-6">
                    Qarzdorlik yo'q
                  </td>
                </tr>
              )}
              {sorted.map((d) => {
                const days = daysSince(d.sana);
                const bm = BUCKET_META[bucketOf(days)];
                return (
                  <tr key={d.id} className={d.isYopilgan ? "opacity-50" : ""}>
                    <td className="py-2.5 font-medium">
                      {d.mijozNomi}
                      {!d.isYopilgan && (
                        <span className={`ml-2 text-2xs ${bm.cls}`}>{days} kun</span>
                      )}
                    </td>
                    <td className="py-2.5 text-muted">{d.mijozTel ?? "—"}</td>
                    <td className="py-2.5 text-right tnum">{formatSomLabel(d.jamiSumma)}</td>
                    <td className="py-2.5 text-right text-income tnum">{formatSom(d.tolangan)}</td>
                    <td className="py-2.5 text-right font-medium text-debt tnum">{formatSom(d.qolgan)}</td>
                    <td className="py-2.5 text-muted whitespace-nowrap">{formatDateUZ(new Date(d.sana))}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {d.isYopilgan ? (
                        <Badge tone="kirim">Yopilgan</Badge>
                      ) : (
                        <>
                          <button onClick={() => reminder(d)} className="text-xs font-medium text-muted hover:text-fg mr-3">
                            Eslatma
                          </button>
                          <button onClick={() => setPayFor(d)} className="text-xs font-medium text-income hover:text-income-fg">
                            To'lov
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
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
        <p className="text-sm text-muted">
          Qolgan qarz: <span className="font-medium text-debt">{formatSomLabel(debt.qolgan)}</span>
        </p>
        <div>
          <label className="block text-xs text-muted mb-1">To'lov summasi (so'm)</label>
          <input
            type="text"
            inputMode="numeric"
            value={summa}
            onChange={(e) => setSumma(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            autoFocus
          />
        </div>
        {error && <p className="text-expense text-sm">{error}</p>}
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
