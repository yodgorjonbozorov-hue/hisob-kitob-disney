"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatSom, parseSomInput } from "@/lib/format";
import type { ProductAdminDTO } from "@/lib/queries/inventory";
import { NarxQatori } from "./NarxQatori";

/** Bitta tovarning tahrirlanayotgan qiymatlari (matn — inputdagi holat). */
export interface Kiritma {
  kelgan: string;
  sotuv: string;
  qoldiq: string;
}

/** Bir yurishda yuboriladigan maksimal qator — server sxemasi bilan bir xil. */
const MAKS_SAQLASH = 500;

/**
 * NARX VA QOLDIQNI TO'LDIRISH JADVALI.
 *
 * Faqat O'ZGARTIRILGAN qatorlar yuboriladi: 200 ta tovarning hammasini
 * qayta yozish keraksiz yozuv va keraksiz "inventarizatsiya" izlari
 * yaratardi.
 */
export function NarxlarClient({
  products,
  biznesNomi,
}: {
  products: ProductAdminDTO[];
  biznesNomi: string;
}) {
  const router = useRouter();
  const [qidiruv, setQidiruv] = useState("");
  const [faqatBosh, setFaqatBosh] = useState(true);
  const [kiritma, setKiritma] = useState<Record<string, Kiritma>>({});
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [natija, setNatija] = useState<string | null>(null);

  const boshSoni = products.filter((p) => p.sotuvNarx === 0 || p.miqdor === 0).length;

  const korinadi = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    return products.filter((p) => {
      if (faqatBosh && p.sotuvNarx > 0 && p.miqdor > 0) return false;
      if (!q) return true;
      return p.nomi.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q);
    });
  }, [products, qidiruv, faqatBosh]);

  function ozgartir(id: string, maydon: keyof Kiritma, qiymat: string) {
    setNatija(null);
    setKiritma((oldin) => {
      const p = products.find((x) => x.id === id);
      const joriy = oldin[id] ?? {
        kelgan: p && p.kelganNarx > 0 ? formatSom(p.kelganNarx) : "",
        sotuv: p && p.sotuvNarx > 0 ? formatSom(p.sotuvNarx) : "",
        qoldiq: p && p.miqdor > 0 ? String(p.miqdor) : "",
      };
      return { ...oldin, [id]: { ...joriy, [maydon]: qiymat } };
    });
  }

  /** Faqat haqiqatan o'zgargan qatorlar — tegilmagani yuborilmaydi. */
  const ozgarganlar = useMemo(() => {
    const chiqadi: {
      productId: string;
      kelganNarx?: number;
      sotuvNarx?: number;
      miqdor?: number;
    }[] = [];
    for (const [id, k] of Object.entries(kiritma)) {
      const p = products.find((x) => x.id === id);
      if (!p) continue;
      const qator: { productId: string; kelganNarx?: number; sotuvNarx?: number; miqdor?: number } =
        { productId: id };
      let bor = false;
      if (k.kelgan.trim() !== "" && parseSomInput(k.kelgan) !== p.kelganNarx) {
        qator.kelganNarx = parseSomInput(k.kelgan);
        bor = true;
      }
      if (k.sotuv.trim() !== "" && parseSomInput(k.sotuv) !== p.sotuvNarx) {
        qator.sotuvNarx = parseSomInput(k.sotuv);
        bor = true;
      }
      if (k.qoldiq.trim() !== "" && parseSomInput(k.qoldiq) !== p.miqdor) {
        qator.miqdor = parseSomInput(k.qoldiq);
        bor = true;
      }
      if (bor) chiqadi.push(qator);
    }
    return chiqadi;
  }, [kiritma, products]);

  async function saqla() {
    if (ozgarganlar.length === 0) return;
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/products/narxlar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qatorlar: ozgarganlar.slice(0, MAKS_SAQLASH) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Saqlab bo'lmadi");
        return;
      }
      setNatija(
        `${data.yangilandi} ta tovar saqlandi` +
          (data.qoldiqTogrilandi > 0 ? `, ${data.qoldiqTogrilandi} tasida qoldiq yozildi` : "")
      );
      setKiritma({});
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-fg">Narx va qoldiqni to&apos;ldirish</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{biznesNomi}</span> · to&apos;ldirilmagan{" "}
          {boshSoni} ta
        </p>
      </div>

      <Card>
        <p className="text-sm text-fg">
          Kassada sotilishi uchun tovarning <span className="font-medium">sotuv narxi</span> ham,{" "}
          <span className="font-medium">qoldig&apos;i</span> ham bo&apos;lishi kerak.
        </p>
        <p className="text-xs text-muted mt-2">
          Bu yerdagi qoldiq — ombordagi mavjud tovar (inventarizatsiya). U{" "}
          <span className="font-medium">pul harakati yaratmaydi</span>: yangi xarid qilsangiz
          Ombor sahifasidagi &quot;Kirim&quot; dan foydalaning, u xarid chiqimini yozadi.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder="Nomi yoki SKU bo'yicha qidirish"
          className="flex-1 min-w-[200px] rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
        />
        <button
          type="button"
          onClick={() => setFaqatBosh((v) => !v)}
          className={`rounded-xl border px-3 py-2 text-sm ${
            faqatBosh ? "border-brand bg-brand-wash text-brand font-medium" : "border-line text-muted"
          }`}
        >
          Faqat to&apos;ldirilmaganlar
        </button>
      </div>

      <Card className="p-0 overflow-hidden">
        {/* Sarlavha faqat kengroq ekranda — telefonda har qator o'zi
            imzolangan kartochka bo'lib chiqadi. */}
        <div className="hidden lg:grid grid-cols-[1fr_130px_130px_110px] gap-3 px-4 py-2 bg-surface-2 text-xs uppercase text-muted">
          <span>Tovar</span>
          <span className="text-right">Tannarx</span>
          <span className="text-right">Sotuv narxi</span>
          <span className="text-right">Qoldiq</span>
        </div>
        <div className="divide-y divide-line max-h-[60vh] overflow-y-auto">
          {korinadi.map((p) => (
            <NarxQatori
              key={p.id}
              product={p}
              kiritma={kiritma[p.id]}
              onOzgartir={(maydon, qiymat) => ozgartir(p.id, maydon, qiymat)}
            />
          ))}
          {korinadi.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted text-center">
              {faqatBosh ? "Hamma tovar to'ldirilgan." : "Tovar topilmadi."}
            </p>
          )}
        </div>
      </Card>

      {xato && <p className="text-sm text-expense">{xato}</p>}
      {natija && <p className="text-sm text-income">{natija}</p>}

      <div className="flex flex-wrap gap-2 items-center justify-end sticky bottom-3">
        <Link href="/app/ombor">
          <Button variant="secondary">Omborga qaytish</Button>
        </Link>
        <Button onClick={saqla} loading={loading} disabled={ozgarganlar.length === 0}>
          {ozgarganlar.length > 0 ? `${ozgarganlar.length} ta o'zgarishni saqlash` : "Saqlash"}
        </Button>
      </div>
    </div>
  );
}
