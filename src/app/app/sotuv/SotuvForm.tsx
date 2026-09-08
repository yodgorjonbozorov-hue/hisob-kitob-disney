"use client";

import { useState, FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { formatSomLabel } from "@/lib/format";
import { isAvto, omborMatn } from "@/lib/biznesTuri";
import type { ProductKassirDTO, SaleDTO } from "@/lib/queries/inventory";
import { MijozTanlash, type MijozTanlov } from "@/components/qarz/MijozTanlash";
import type { AccountDTO } from "@/lib/queries/accounts";
import { todayDateOnlyString } from "@/lib/date";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { TolovTuriTanlov } from "./TolovTuriTanlov";
import { MahsulotTanlashModal } from "./MahsulotTanlashModal";
import { SavatRoyxat, type SavatQatori } from "./SavatRoyxat";

/**
 * Yangi sotuv formasi. Narx siyosati:
 * - Mahsulot tanlanganda standart sotuv narxi qatorga to'ldiriladi.
 * - Savdolashib boshqa narxga kelishilgan bo'lsa — kassir shu qatorda
 *   o'zgartiradi; sotuv haqiqiy kelishilgan narxda yoziladi.
 *
 * MIJOZ har sotuvda tanlanadi (tepada): optom biznesda MAJBURIY,
 * chakanada ixtiyoriy, qarzga sotuvda har doim majburiy. Server ham xuddi
 * shu qoidani tekshiradi (lib/services/inventory.ts).
 *
 * ═══ SAVAT ═══
 * Mijoz tanlangach BIR OYNADA bir necha mahsulot tanlanadi va hammasi
 * savatga tushadi (`MahsulotTanlashModal`). Ilgari har mahsulot uchun
 * forma qaytadan to'ldirilardi — 6 ta tovar sotish 6 ta alohida sotuv
 * demakdi. Endi savat BITTA atomik so'rovda yoziladi: yo hammasi, yo
 * hech nimasi (lib/services/inventory.ts → `createSaleKop`).
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
  onSold: (sales: SaleDTO[]) => void;
}) {
  const avto = isAvto(biznesTuri);
  const M = omborMatn(biznesTuri);
  const [savat, setSavat] = useState<SavatQatori[]>([]);
  const [tanlovOchiq, setTanlovOchiq] = useState(false);
  const [tolovTuri, setTolovTuri] = useState<"naqd" | "qarz">("naqd");
  const [accountId, setAccountId] = useState("");
  const [mijoz, setMijoz] = useState<MijozTanlov>({ contactId: null, ism: "", tel: "" });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sana, setSana] = useState(todayDateOnlyString());

  const jami = savat.reduce((s, q) => s + q.miqdor * q.narx, 0);
  const mijozMajburiy = tolovTuri === "qarz" || optom;
  const mijozBor = Boolean(mijoz.contactId || mijoz.ism.trim());
  const savatda = Object.fromEntries(savat.map((q) => [q.productId, q.miqdor]));

  /**
   * TANLANGANLARNI SAVATGA QO'SHISH.
   *
   * Takror tanlangan mahsulot yangi qator ochmaydi — mavjud qatorning
   * miqdori oshadi va qoldiq bilan cheklanadi (`createSaleKop` serverda
   * ayni birlashtirishni takrorlaydi).
   */
  function qoshish(tanlov: { productId: string; miqdor: number }[]) {
    setError(null);
    setSavat((oldingi) => {
      // HOLAT O'ZGARTIRILMAYDI, QAYTA QURILADI: mavjud qatorni joyida
      // (`bor.miqdor += ...`) o'zgartirish React holatini buzadi — StrictMode
      // yangilagichni ikki marta chaqiradi va miqdor ikki barobar oshib
      // ketardi. Shuning uchun har qator YANGI obyekt bo'lib chiqadi.
      const xarita = new Map(oldingi.map((q) => [q.productId, { ...q }]));
      for (const t of tanlov) {
        const p = products.find((x) => x.id === t.productId);
        if (!p) continue;
        const bor = xarita.get(t.productId);
        if (bor) {
          xarita.set(t.productId, {
            ...bor,
            miqdor: Math.min(p.qoldiq, bor.miqdor + t.miqdor),
          });
        } else {
          xarita.set(p.id, {
            productId: p.id,
            nomi: p.nomi,
            birlik: p.birlik,
            qoldiq: p.qoldiq,
            miqdor: Math.min(p.qoldiq, t.miqdor),
            narx: p.sotuvNarx,
            standartNarx: p.sotuvNarx,
          });
        }
      }
      return [...xarita.values()];
    });
  }

  function qatorniOzgart(productId: string, qism: Partial<SavatQatori>) {
    setSavat((s) => s.map((q) => (q.productId === productId ? { ...q, ...qism } : q)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (savat.length === 0) return setError(avto ? "Mashinani tanlang" : "Mahsulot tanlang");
    if (savat.some((q) => q.miqdor <= 0)) return setError("Miqdorni kiriting");
    const narxsiz = savat.find((q) => q.narx <= 0);
    if (narxsiz) return setError(`Narxni kiriting: ${narxsiz.nomi}`);
    if (savat.some((q) => q.miqdor > q.qoldiq))
      return setError("Miqdor ombordagi qoldiqdan ko'p bo'lmasligi kerak");
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
          qatorlar: savat.map((q) => ({
            productId: q.productId,
            miqdor: q.miqdor,
            narx: q.narx > 0 ? q.narx : undefined,
          })),
          tolovTuri,
          contactId: mijozBor ? (mijoz.contactId ?? undefined) : undefined,
          mijozNomi: mijozBor ? mijoz.ism.trim() || undefined : undefined,
          mijozTel: mijozBor ? mijoz.tel.trim() || undefined : undefined,
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
          ? `Sotildi: ${savat.length} ta mahsulot = ${formatSomLabel(jami)}`
          : `Qarzga sotildi: ${mijoz.ism} — ${formatSomLabel(jami)}`
      );
      const vaqt = new Date().toISOString();
      onSold(
        savat.map((q, i) => ({
          id: data.sotuvlar?.[i]?.id ?? `${Math.random()}`,
          productNomi: q.nomi,
          miqdor: q.miqdor,
          jamiSumma: q.miqdor * q.narx,
          tolovTuri,
          mijozNomi: mijozBor ? mijoz.ism : null,
          sana: new Date(`${sana}T00:00:00.000Z`).toISOString(),
          vaqt,
          bekorQilingan: false,
          bekorSabab: null,
        }))
      );
      setSavat([]);
      setMijoz({ contactId: null, ism: "", tel: "" });
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
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`${LABEL_CLASS} mb-0`}>{M.birlikBosh}</span>
            <Button
              size="sm"
              onClick={() => setTanlovOchiq(true)}
              disabled={loading}
              data-test="mahsulot-qoshish"
            >
              + Mahsulot qo&apos;shish
            </Button>
          </div>
          <SavatRoyxat
            qatorlar={savat}
            onOzgart={qatorniOzgart}
            onOchir={(id) => setSavat((s) => s.filter((q) => q.productId !== id))}
            disabled={loading}
            avto={avto}
          />
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
              Click yoki terminal orqali to&apos;langan bo&apos;lsa — tegishli kassani tanlang,
              hisobot kassalar bo&apos;yicha to&apos;g&apos;ri chiqadi.
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

        <Button type="submit" disabled={loading || savat.length === 0} loading={loading} className="w-full" size="lg">
          {avto ? "Mashinani sotish" : "Sotuvni yakunlash"}
        </Button>
      </form>

      <MahsulotTanlashModal
        ochiq={tanlovOchiq}
        onClose={() => setTanlovOchiq(false)}
        products={products}
        savatda={savatda}
        onQoshish={qoshish}
        avto={avto}
      />
    </Card>
  );
}
