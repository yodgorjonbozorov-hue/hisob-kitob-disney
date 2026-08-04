"use client";

import { useState, useMemo, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatSom, formatSomLabel, parseSomInput, formatDateUZ } from "@/lib/format";
import { isAvto, omborMatn } from "@/lib/biznesTuri";
import type { ProductKassirDTO, SaleDTO } from "@/lib/queries/inventory";
import { todayDateOnlyString } from "@/lib/date";
import { SotuvBekorModal } from "./SotuvBekorModal";

export function SotuvClient({
  products,
  initialSales,
  biznesTuri = "umumiy",
  bekorQilaOladi = false,
}: {
  products: ProductKassirDTO[];
  initialSales: SaleDTO[];
  biznesTuri?: string;
  /** Sotuvni bekor qilish faqat direktor/adminda (kassir o'z xatosini yashira olmasin). */
  bekorQilaOladi?: boolean;
}) {
  const router = useRouter();
  const avto = isAvto(biznesTuri);
  const M = omborMatn(biznesTuri);
  const [productId, setProductId] = useState("");
  // Avto rejimida bitta yozuv = bitta mashina — miqdor har doim 1.
  const [miqdor, setMiqdor] = useState("1");
  const [tolovTuri, setTolovTuri] = useState<"naqd" | "qarz">("naqd");
  // Avto: kelishilgan narx. Mashina tanlanganda rejadagi narx bilan to'ldiriladi.
  const [narx, setNarx] = useState("");
  const [mijozNomi, setMijozNomi] = useState("");
  const [mijozTel, setMijozTel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState(initialSales);
  // Orqaga sana bilan sotuv kiritish (B-5): kechagi sotuv kechagi hisobotga tushsin.
  const [sana, setSana] = useState(todayDateOnlyString());
  const [bekorId, setBekorId] = useState<string | null>(null);

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const qty = avto ? 1 : parseSomInput(miqdor);
  const kelishilgan = parseSomInput(narx);
  const jami = avto
    ? kelishilgan || (selected?.sotuvNarx ?? 0)
    : selected
      ? selected.sotuvNarx * qty
      : 0;

  // Mashina tanlanganda maydonni rejadagi narx bilan to'ldiramiz (kerak bo'lsa tahrirlanadi).
  function mashinaTanlandi(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    setNarx(p && p.sotuvNarx > 0 ? formatSom(p.sotuvNarx) : "");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!selected) {
      setError(avto ? "Mashinani tanlang" : "Mahsulot tanlang");
      return;
    }
    if (!selected.mavjud) {
      setError(avto ? "Bu mashina allaqachon sotilgan" : "Bu mahsulot omborda qolmadi");
      return;
    }
    if (qty <= 0) {
      setError("Miqdorni kiriting");
      return;
    }
    if (avto && kelishilgan <= 0) {
      setError("Kelishilgan narxni kiriting");
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
          narx: avto && kelishilgan > 0 ? kelishilgan : undefined,
          sana,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setOk(
        tolovTuri === "naqd"
          ? `Sotildi: ${selected.nomi}${avto ? "" : ` × ${qty}`} = ${formatSomLabel(jami)}`
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
          sana: new Date(`${sana}T00:00:00.000Z`).toISOString(),
          bekorQilingan: false,
          bekorSabab: null,
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
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <h2 className="font-semibold text-fg mb-3">{avto ? "Mashina sotish" : "Yangi sotuv"}</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">{M.birlikBosh}</label>
            <select
              value={productId}
              onChange={(e) => (avto ? mashinaTanlandi(e.target.value) : setProductId(e.target.value))}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="">Tanlang...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.mavjud}>
                  {p.nomi} — {formatSomLabel(p.sotuvNarx)}
                  {p.mavjud ? "" : avto ? " (Sotilgan)" : " (Qolmadi)"}
                </option>
              ))}
            </select>
          </div>

          {avto ? (
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Kelishilgan narx (sotilgan summa)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={narx}
                onChange={(e) => setNarx(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
                placeholder="0"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
              <p className="text-xs text-faint mt-1">
                Savdolashib boshqa narxga kelishilgan bo'lsa — shu yerga yozing, mashina kartochkasi
                ham yangilanadi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Miqdor (dona)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={miqdor}
                  onChange={(e) => setMiqdor(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Jami</label>
                <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-fg">
                  {formatSomLabel(jami)}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTolovTuri("naqd")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                tolovTuri === "naqd" ? "bg-income text-white" : "bg-income-soft text-income-fg"
              }`}
            >
              Naqd
            </button>
            <button
              type="button"
              onClick={() => setTolovTuri("qarz")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                tolovTuri === "qarz" ? "bg-debt text-white" : "bg-debt-soft text-debt-fg"
              }`}
            >
              Qarzga
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1" htmlFor="sotuv-sana">
              Sana
            </label>
            <input
              id="sotuv-sana"
              type="date"
              value={sana}
              onChange={(e) => setSana(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>

          {tolovTuri === "qarz" && (
            <div className="space-y-2">
              <input
                type="text"
                value={mijozNomi}
                onChange={(e) => setMijozNomi(e.target.value)}
                placeholder={avto ? "Xaridor ismi" : "Mijoz ismi"}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={mijozTel}
                onChange={(e) => setMijozTel(e.target.value)}
                placeholder="Telefon (ixtiyoriy)"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
          )}

          {error && <p className="text-expense text-sm">{error}</p>}
          {ok && <p className="text-income text-sm">{ok}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saqlanmoqda..." : avto ? "Mashinani sotish" : "Sotish"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-fg mb-3">So'nggi sotuvlar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-faint text-xs uppercase">
                <th className="pb-2">Sana</th>
                <th className="pb-2">{M.birlikBosh}</th>
                <th className="pb-2 text-right">Summa</th>
                <th className="pb-2">To&apos;lov</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sales.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-faint py-6">
                    Hali sotuv yo'q
                  </td>
                </tr>
              )}
              {sales.map((s) => (
                <tr key={s.id} className={s.bekorQilingan ? "opacity-50 line-through" : ""}>
                  <td className="py-2 whitespace-nowrap">{formatDateUZ(new Date(s.sana))}</td>
                  <td className="py-2">
                    {s.productNomi}
                    {!avto && <span className="text-faint"> × {s.miqdor}</span>}
                    {s.bekorQilingan && (
                      <span className="block text-2xs text-expense no-underline">
                        Bekor qilindi{s.bekorSabab ? `: ${s.bekorSabab}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-medium">{formatSomLabel(s.jamiSumma)}</td>
                  <td className="py-2">
                    <Badge tone={s.tolovTuri === "naqd" ? "kirim" : "neutral"}>
                      {s.tolovTuri === "naqd" ? "Naqd" : "Qarz"}
                    </Badge>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {!s.bekorQilingan && (
                      <a
                        href={`/api/sales/${s.id}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-2xs text-brand hover:underline"
                      >
                        Chek
                      </a>
                    )}
                    {bekorQilaOladi && !s.bekorQilingan && (
                      <button
                        type="button"
                        onClick={() => setBekorId(s.id)}
                        className="text-2xs text-expense hover:underline ml-3"
                      >
                        Bekor qilish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>

    {bekorId && (
      <SotuvBekorModal
        saleId={bekorId}
        onClose={() => setBekorId(null)}
        onDone={() => {
          setBekorId(null);
          router.refresh();
        }}
      />
    )}
    </>
  );
}
