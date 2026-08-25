"use client";

import { useState, useMemo, FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import { isAvto, omborMatn } from "@/lib/biznesTuri";
import type { ProductKassirDTO, SaleDTO } from "@/lib/queries/inventory";
import { MijozTanlash, type MijozTanlov } from "@/components/qarz/MijozTanlash";
import type { AccountDTO } from "@/lib/queries/accounts";
import { todayDateOnlyString } from "@/lib/date";

/**
 * Yangi sotuv formasi. Narx siyosati:
 * - Mahsulot tanlanganda standart sotuv narxi maydonga to'ldiriladi.
 * - Savdolashib boshqa narxga kelishilgan bo'lsa — kassir shu maydonda
 *   o'zgartiradi; sotuv haqiqiy kelishilgan narxda yoziladi, mahsulot
 *   kartochkasidagi standart narx esa O'ZGARMAYDI (faqat avto rejimida
 *   kartochka yangilanadi — bitta yozuv = bitta mashina).
 * - Standart narxdan farq ko'rinib turadi — «har kim har xil narxda sotadi»
 *   holati yashirin qolmasligi kerak.
 */
export function SotuvForm({
  products,
  biznesTuri,
  kassalar,
  onSold,
}: {
  products: ProductKassirDTO[];
  biznesTuri: string;
  /** Faol kassalar — naqd sotuvda pul qaysi kassaga tushishini tanlash uchun. */
  kassalar: AccountDTO[];
  onSold: (sale: SaleDTO) => void;
}) {
  const avto = isAvto(biznesTuri);
  const M = omborMatn(biznesTuri);
  const [productId, setProductId] = useState("");
  // Avto rejimida bitta yozuv = bitta mashina — miqdor har doim 1.
  const [miqdor, setMiqdor] = useState("1");
  const [tolovTuri, setTolovTuri] = useState<"naqd" | "qarz">("naqd");
  // Kelishilgan narx (birlik). Tanlanganda standart narx bilan to'ldiriladi.
  const [narx, setNarx] = useState("");
  // Naqd sotuvda pul tushadigan kassa. Bo'sh = standart (birinchi) kassa.
  const [accountId, setAccountId] = useState("");
  const [mijoz, setMijoz] = useState<MijozTanlov>({ contactId: null, ism: "", tel: "" });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Orqaga sana bilan sotuv kiritish (B-5): kechagi sotuv kechagi hisobotga tushsin.
  const [sana, setSana] = useState(todayDateOnlyString());

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const qty = avto ? 1 : parseSomInput(miqdor);
  const kelishilgan = parseSomInput(narx);
  const birlikNarx = kelishilgan > 0 ? kelishilgan : (selected?.sotuvNarx ?? 0);
  const jami = birlikNarx * qty;
  const farq = selected && selected.sotuvNarx > 0 && kelishilgan > 0 ? kelishilgan - selected.sotuvNarx : 0;

  // Tanlanganda maydon standart narx bilan to'ldiriladi (kerak bo'lsa tahrirlanadi).
  function mahsulotTanlandi(id: string) {
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
    if (birlikNarx <= 0) {
      setError(
        avto
          ? "Kelishilgan narxni kiriting"
          : "Narxni kiriting — bu mahsulotga standart narx qo'yilmagan"
      );
      return;
    }
    if (tolovTuri === "qarz" && !mijoz.ism.trim()) {
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
          contactId: tolovTuri === "qarz" ? (mijoz.contactId ?? undefined) : undefined,
          mijozNomi: tolovTuri === "qarz" ? mijoz.ism.trim() : undefined,
          mijozTel: tolovTuri === "qarz" ? mijoz.tel.trim() || undefined : undefined,
          narx: kelishilgan > 0 ? kelishilgan : undefined,
          accountId: tolovTuri === "naqd" && accountId ? accountId : undefined,
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
          : `Qarzga sotildi: ${mijoz.ism} — ${formatSomLabel(jami)}`
      );
      onSold({
        id: data.id ?? Math.random().toString(),
        productNomi: selected.nomi,
        miqdor: qty,
        jamiSumma: jami,
        tolovTuri,
        mijozNomi: tolovTuri === "qarz" ? mijoz.ism : null,
        sana: new Date(`${sana}T00:00:00.000Z`).toISOString(),
        bekorQilingan: false,
        bekorSabab: null,
      });
      setMiqdor("1");
      setNarx("");
      setMijoz({ contactId: null, ism: "", tel: "" });
      setProductId("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold text-fg mb-3">{avto ? "Mashina sotish" : "Yangi sotuv"}</h2>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">{M.birlikBosh}</label>
          <select
            value={productId}
            onChange={(e) => mahsulotTanlandi(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          >
            <option value="">Tanlang...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.mavjud}>
                {p.nomi} — {p.sotuvNarx > 0 ? formatSomLabel(p.sotuvNarx) : "narx kelishiladi"}
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
          <>
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
                <label className="block text-xs font-medium text-muted mb-1">
                  Birlik narx (kelishilgan)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={narx}
                  onChange={(e) => setNarx(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
                  placeholder={selected && selected.sotuvNarx === 0 ? "Narxni yozing" : "0"}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
            </div>
            {farq !== 0 && (
              <p className={`text-xs ${farq < 0 ? "text-expense" : "text-income"}`}>
                Standart narx {formatSomLabel(selected!.sotuvNarx)} — bu sotuv{" "}
                {formatSomLabel(Math.abs(farq))} {farq < 0 ? "arzon" : "qimmat"} ketmoqda.
              </p>
            )}
            {selected && selected.sotuvNarx === 0 && (
              <p className="text-xs text-faint">
                Bu mahsulotga standart narx qo'yilmagan — kelishilgan narxni har sotuvda yozasiz.
                Standart narxni Ombor bo'limida («Narx» tugmasi) belgilash mumkin.
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Jami</label>
              <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-fg">
                {formatSomLabel(jami)}
              </div>
            </div>
          </>
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

        {tolovTuri === "naqd" && kassalar.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-muted mb-1" htmlFor="sotuv-kassa">
              Pul qaysi kassaga tushdi
            </label>
            <select
              id="sotuv-kassa"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              {kassalar.map((k, i) => (
                <option key={k.id} value={i === 0 ? "" : k.id}>
                  {k.nomi}
                </option>
              ))}
            </select>
            <p className="text-2xs text-faint mt-1">
              Click yoki terminal orqali to'langan bo'lsa — tegishli kassani tanlang, hisobot
              kassalar bo'yicha to'g'ri chiqadi.
            </p>
          </div>
        )}

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
          /* Mijoz tanlash — qarzlar sahifasi va kassa bilan AYNI komponent.
             Mavjud mijoz qidirib topiladi (joriy qarzi ko'rinadi) yoki
             "+ Yangi mijoz" bilan kartochka ochiladi. Ism qo'lda yozilsa ham
             server kartochkani o'zi topadi/yaratadi — bir mijoz bitta qarzdor
             (lib/services/mijozAniqla.ts). */
          <MijozTanlash
            qiymat={mijoz}
            onChange={setMijoz}
            disabled={loading}
            yangiSumma={jami}
          />
        )}

        {error && <p className="text-expense text-sm">{error}</p>}
        {ok && <p className="text-income text-sm">{ok}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Saqlanmoqda..." : avto ? "Mashinani sotish" : "Sotish"}
        </Button>
      </form>
    </Card>
  );
}
