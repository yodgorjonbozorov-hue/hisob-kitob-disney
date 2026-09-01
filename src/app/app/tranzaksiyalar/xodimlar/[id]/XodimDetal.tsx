"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { formatSom, formatDate } from "@/lib/format";
import { TOLOV_GURUHLARI, TOLOV_GURUHI_NOMI } from "@/lib/tolovBolimi";
import type { XodimDetalDTO } from "@/lib/queries/xodimStatistika";
import { tolovYorligi } from "../../turlar";
import { DavrFiltri, BOSH_DAVR, type Davr } from "../DavrFiltri";

/**
 * XODIM TAFSILOTI (klient): davr KPI + sana/kategoriya/to'lov filtrlari +
 * yozuvlar lentasi. Mobil uchun karta-qatorlar, jadval yo'q; sahifalash —
 * "Yana ko'rsatish" (qo'shib boradi).
 */
export function XodimDetal({
  xodimId,
  initial,
  kategoriyalar,
}: {
  xodimId: string;
  initial: XodimDetalDTO;
  kategoriyalar: { id: string; nomi: string }[];
}) {
  const [davr, setDavr] = useState<Davr>(BOSH_DAVR);
  const [categoryId, setCategoryId] = useState("");
  const [tolov, setTolov] = useState("");
  const [data, setData] = useState<XodimDetalDTO>(initial);
  const [loading, setLoading] = useState(false);
  const birinchi = useRef(true);

  function url(page: number) {
    const p = new URLSearchParams({ from: davr.from, to: davr.to, page: String(page) });
    if (categoryId) p.set("categoryId", categoryId);
    if (tolov) p.set("tolov", tolov);
    return `/api/transactions/xodimlar-statistika/${xodimId}?${p}`;
  }

  useEffect(() => {
    // Boshlang'ich "Bu oy" serverdan kelgan — qayta so'ralmaydi.
    if (birinchi.current) {
      birinchi.current = false;
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(url(1), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: XodimDetalDTO) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [davr.from, davr.to, categoryId, tolov]);

  async function yanaYuklash() {
    setLoading(true);
    try {
      const r = await fetch(url(data.page + 1));
      if (!r.ok) return;
      const d: XodimDetalDTO = await r.json();
      setData({ ...d, items: [...data.items, ...d.items] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <DavrFiltri davr={davr} onChange={setDavr} />

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Zakazlar" qiymat={`${data.stat.zakazlar} ta`} />
        <Kpi label="Jami savdo" qiymat={formatSom(data.stat.summa)} />
        <Kpi label="O'rtacha" qiymat={formatSom(data.stat.ortacha)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          aria-label="Kategoriya filtri"
          value={categoryId}
          onChange={setCategoryId}
          searchable={kategoriyalar.length > 7}
          options={[
            { value: "", label: "Barcha kategoriyalar" },
            ...kategoriyalar.map((k) => ({ value: k.id, label: k.nomi })),
          ]}
        />
        <Select
          aria-label="To'lov turi filtri"
          value={tolov}
          onChange={setTolov}
          options={[
            { value: "", label: "Barcha to'lovlar" },
            ...TOLOV_GURUHLARI.map((t) => ({ value: t, label: TOLOV_GURUHI_NOMI[t] })),
          ]}
        />
      </div>

      <Card className="p-0 overflow-hidden">
        {data.items.length === 0 ? (
          <EmptyState
            title="Yozuv topilmadi"
            description="Tanlangan davr va filtrlarga mos kirim yo'q."
          />
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-fg truncate">
                    {t.category.nomi}
                    {t.crmBuyurtma && <span className="ml-1.5 text-xs text-muted">· CRM</span>}
                  </span>
                  <span className="block text-xs text-muted truncate">
                    {formatDate(new Date(t.sana))} · {tolovYorligi(t)}
                    {t.izoh ? ` · ${t.izoh}` : ""}
                  </span>
                </span>
                <span className="font-display tnum font-semibold text-income whitespace-nowrap">
                  + {formatSom(t.summa)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {data.items.length < data.total && (
        <Button variant="secondary" loading={loading} onClick={yanaYuklash} className="w-full">
          Yana ko&apos;rsatish ({data.total - data.items.length} ta qoldi)
        </Button>
      )}
    </div>
  );
}

function Kpi({ label, qiymat }: { label: string; qiymat: string }) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-display tnum font-semibold text-fg truncate" title={qiymat}>
        {qiymat}
      </p>
    </Card>
  );
}
