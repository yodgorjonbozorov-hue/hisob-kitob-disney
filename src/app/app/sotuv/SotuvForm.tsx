"use client";

import { useState, useMemo, FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Select } from "@/components/ui/Select";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import { isAvto, omborMatn } from "@/lib/biznesTuri";
import type { ProductKassirDTO, SaleDTO } from "@/lib/queries/inventory";
import { MijozTanlash, type MijozTanlov } from "@/components/qarz/MijozTanlash";
import type { AccountDTO } from "@/lib/queries/accounts";
import { todayDateOnlyString } from "@/lib/date";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { TolovTuriTanlov } from "./TolovTuriTanlov";

/**
 * Yangi sotuv formasi. Narx siyosati:
 * - Mahsulot tanlanganda standart sotuv narxi maydonga to'ldiriladi.
 * - Savdolashib boshqa narxga kelishilgan bo'lsa — kassir shu maydonda
 *   o'zgartiradi; sotuv haqiqiy kelishilgan narxda yoziladi.
 *
 * MIJOZ endi har sotuvda tanlanadi (tepada): optom biznesda MAJBURIY,
 * chakanada ixtiyoriy, qarzga sotuvda har doim majburiy. Server ham xuddi
 * shu qoidani tekshiradi (lib/services/inventory.ts).
 */
export function SotuvForm({
  products,
  biznesTuri,
  kassalar,
  optom = false,
  onSold,
}: {
  products: ProductKassirDTO[];
  biznesTuri: string;
  /** Faol kassalar — naqd sotuvda pul qaysi kassaga tushishini tanlash uchun. */
  kassalar: AccountDTO[];
  /** Optom biznes — mijoz naqd sotuvda ham majburiy. */
  optom?: boolean;
  onSold: (sale: SaleDTO) => void;
}) {
  const avto = isAvto(biznesTuri);
  const M = omborMatn(biznesTuri);
  const [productId, setProductId] = useState("");
  const [miqdor, setMiqdor] = useState("1");
  const [tolovTuri, setTolovTuri] = useState<"naqd" | "qarz">("naqd");
  const [narx, setNarx] = useState("");
  const [accountId, setAccountId] = useState("");
  const [mijoz, setMijoz] = useState<MijozTanlov>({ contactId: null, ism: "", tel: "" });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sana, setSana] = useState(todayDateOnlyString());

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const qty = avto ? 1 : parseSomInput(miqdor);
  const kelishilgan = parseSomInput(narx);
  const birlikNarx = kelishilgan > 0 ? kelishilgan : (selected?.sotuvNarx ?? 0);
  const jami = birlikNarx * qty;
  const farq = selected && selected.sotuvNarx > 0 && kelishilgan > 0 ? kelishilgan - selected.sotuvNarx : 0;
  const mijozMajburiy = tolovTuri === "qarz" || optom;
  const mijozBor = Boolean(mijoz.contactId || mijoz.ism.trim());

  function mahsulotTanlandi(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    setNarx(p && p.sotuvNarx > 0 ? formatSom(p.sotuvNarx) : "");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!selected) return setError(avto ? "Mashinani tanlang" : "Mahsulot tanlang");
    if (!selected.mavjud)
      return setError(avto ? "Bu mashina allaqachon sotilgan" : "Bu mahsulot omborda qolmadi");
    if (qty <= 0) return setError("Miqdorni kiriting");
    if (birlikNarx <= 0)
      return setError(
        avto ? "Kelishilgan narxni kiriting" : "Narxni kiriting — bu mahsulotga standart narx qo'yilmagan"
      );
    if (mijozMajburiy && !mijozBor)
      return setError(
        tolovTuri === "qarz"
          ? "Qarzga sotishda mijozni tanlang"
          : "Optom sotuvda mijoz tanlanishi shart"
      );
    setLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.id,
          miqdor: qty,
          tolovTuri,
          // Mijoz endi naqd sotuvda ham yuboriladi (tanlangan bo'lsa).
          contactId: mijozBor ? (mijoz.contactId ?? undefined) : undefined,
          mijozNomi: mijozBor ? mijoz.ism.trim() || undefined : undefined,
          mijozTel: mijozBor ? mijoz.tel.trim() || undefined : undefined,
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
        mijozNomi: mijozBor ? mijoz.ism : null,
        sana: new Date(`${sana}T00:00:00.000Z`).toISOString(),
        vaqt: new Date().toISOString(),
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
      <h2 className="font-semibold text-fg mb-4">{avto ? "Mashina sotish" : "Yangi sotuv"}</h2>
      <form onSubmit={submit} className="space-y-4">
        <MijozTanlash
          qiymat={mijoz}
          onChange={setMijoz}
          disabled={loading}
          yangiSumma={jami}
          majburiy={mijozMajburiy}
          qarzPanel={tolovTuri === "qarz"}
        />

        <div>
          <label className={LABEL_CLASS} htmlFor="sotuv-mahsulot">{M.birlikBosh}</label>
          <Select
            id="sotuv-mahsulot"
            value={productId}
            onChange={mahsulotTanlandi}
            searchable={products.length > 7}
            searchPlaceholder={avto ? "Mashinani qidiring..." : "Mahsulotni qidiring..."}
            placeholder="Tanlang..."
            disabled={loading}
            options={products.map((p) => ({
              value: p.id,
              label: p.nomi,
              tavsif: `${p.sotuvNarx > 0 ? formatSomLabel(p.sotuvNarx) : "narx kelishiladi"}${
                p.mavjud ? "" : avto ? " · Sotilgan" : " · Qolmadi"
              }`,
              disabled: !p.mavjud,
            }))}
          />
        </div>

        {avto ? (
          <div>
            <label className={LABEL_CLASS} htmlFor="sotuv-narx">Kelishilgan narx (sotilgan summa)</label>
            <input
              id="sotuv-narx"
              type="text"
              inputMode="numeric"
              value={narx}
              onChange={(e) => setNarx(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
              placeholder="0"
              className={INPUT_CLASS}
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
                <label className={LABEL_CLASS} htmlFor="sotuv-miqdor">Miqdor (dona)</label>
                <input
                  id="sotuv-miqdor"
                  type="text"
                  inputMode="numeric"
                  value={miqdor}
                  onChange={(e) => setMiqdor(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="sotuv-birlik-narx">Birlik narx</label>
                <input
                  id="sotuv-birlik-narx"
                  type="text"
                  inputMode="numeric"
                  value={narx}
                  onChange={(e) => setNarx(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
                  placeholder={selected && selected.sotuvNarx === 0 ? "Narxni yozing" : "0"}
                  className={INPUT_CLASS}
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
          </>
        )}

        {/* JAMI — oddiy input emas, alohida ajralib turadigan yakuniy summa. */}
        <div className="rounded-xl border border-brand/25 bg-brand-wash px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted">Jami</span>
          <Money value={jami} size="xl" tone="brand" />
        </div>

        <TolovTuriTanlov value={tolovTuri} onChange={setTolovTuri} disabled={loading} />

        {tolovTuri === "naqd" && kassalar.length > 1 && (
          <div>
            <label className={LABEL_CLASS} htmlFor="sotuv-kassa">Pul qaysi kassaga tushdi</label>
            <Select
              id="sotuv-kassa"
              value={accountId}
              onChange={setAccountId}
              disabled={loading}
              options={kassalar.map((k, i) => ({ value: i === 0 ? "" : k.id, label: k.nomi }))}
            />
            <p className="text-2xs text-faint mt-1">
              Click yoki terminal orqali to'langan bo'lsa — tegishli kassani tanlang, hisobot
              kassalar bo'yicha to'g'ri chiqadi.
            </p>
          </div>
        )}

        <div>
          <label className={LABEL_CLASS} htmlFor="sotuv-sana">Sana</label>
          <input
            id="sotuv-sana"
            type="date"
            value={sana}
            onChange={(e) => setSana(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        {error && <p className="text-expense text-sm" role="alert">{error}</p>}
        {ok && <p className="text-income text-sm" role="status">{ok}</p>}

        <Button type="submit" disabled={loading} loading={loading} className="w-full" size="lg">
          {avto ? "Mashinani sotish" : "Sotuvni yakunlash"}
        </Button>
      </form>
    </Card>
  );
}
