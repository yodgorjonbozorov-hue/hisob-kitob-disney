"use client";

import { useState, useMemo, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatSom, formatSomLabel, parseSomInput, formatDateUZ } from "@/lib/format";
import type { ProductKassirDTO, SaleDTO } from "@/lib/queries/inventory";

export function SotuvClient({
  products,
  initialSales,
}: {
  products: ProductKassirDTO[];
  initialSales: SaleDTO[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [miqdor, setMiqdor] = useState("1");
  const [tolovTuri, setTolovTuri] = useState<"naqd" | "qarz">("naqd");
  const [mijozNomi, setMijozNomi] = useState("");
  const [mijozTel, setMijozTel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState(initialSales);

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const qty = parseSomInput(miqdor);
  const jami = selected ? selected.sotuvNarx * qty : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!selected) {
      setError("Mahsulot tanlang");
      return;
    }
    if (!selected.mavjud) {
      setError("Bu mahsulot omborda qolmadi");
      return;
    }
    if (qty <= 0) {
      setError("Miqdorni kiriting");
      return;
    }
    if (tolovTuri === "qarz" && !mijozNomi.trim()) {
      setError("Qarzga sotishda mijoz nomini kiriting");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.id,
          miqdor: qty,
          tolovTuri,
          mijozNomi: tolovTuri === "qarz" ? mijozNomi : undefined,
          mijozTel: tolovTuri === "qarz" ? mijozTel : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setOk(
        tolovTuri === "naqd"
          ? `Sotildi: ${selected.nomi} × ${qty} = ${formatSomLabel(jami)}`
          : `Qarzga sotildi: ${mijozNomi} — ${formatSomLabel(jami)}`
      );
      setSales((prev) => [
        {
          id: data.id ?? Math.random().toString(),
          productNomi: selected.nomi,
          miqdor: qty,
          jamiSumma: jami,
          tolovTuri,
          mijozNomi: tolovTuri === "qarz" ? mijozNomi : null,
          sana: new Date().toISOString(),
        },
        ...prev,
      ]);
      setMiqdor("1");
      setMijozNomi("");
      setMijozTel("");
      setProductId("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <h2 className="font-semibold text-slate-700 mb-3">Yangi sotuv</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Mahsulot</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Tanlang...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.mavjud}>
                  {p.nomi} — {formatSomLabel(p.sotuvNarx)}
                  {p.mavjud ? "" : " (Qolmadi)"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Miqdor (dona)</label>
              <input
                type="text"
                inputMode="numeric"
                value={miqdor}
                onChange={(e) => setMiqdor(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Jami</label>
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                {formatSomLabel(jami)}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTolovTuri("naqd")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                tolovTuri === "naqd" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              Naqd
            </button>
            <button
              type="button"
              onClick={() => setTolovTuri("qarz")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                tolovTuri === "qarz" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700"
              }`}
            >
              Qarzga
            </button>
          </div>

          {tolovTuri === "qarz" && (
            <div className="space-y-2">
              <input
                type="text"
                value={mijozNomi}
                onChange={(e) => setMijozNomi(e.target.value)}
                placeholder="Mijoz ismi"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={mijozTel}
                onChange={(e) => setMijozTel(e.target.value)}
                placeholder="Telefon (ixtiyoriy)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {error && <p className="text-rose-600 text-sm">{error}</p>}
          {ok && <p className="text-emerald-600 text-sm">{ok}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saqlanmoqda..." : "Sotish"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-700 mb-3">So'nggi sotuvlar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 text-xs uppercase">
                <th className="pb-2">Sana</th>
                <th className="pb-2">Mahsulot</th>
                <th className="pb-2 text-right">Summa</th>
                <th className="pb-2">To'lov</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-400 py-6">
                    Hali sotuv yo'q
                  </td>
                </tr>
              )}
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 whitespace-nowrap">{formatDateUZ(new Date(s.sana))}</td>
                  <td className="py-2">
                    {s.productNomi} <span className="text-slate-400">× {s.miqdor}</span>
                  </td>
                  <td className="py-2 text-right font-medium">{formatSomLabel(s.jamiSumma)}</td>
                  <td className="py-2">
                    <Badge tone={s.tolovTuri === "naqd" ? "kirim" : "neutral"}>
                      {s.tolovTuri === "naqd" ? "Naqd" : "Qarz"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
