"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { Jadval, type Ustun } from "@/components/ui/Jadval";
import { formatSomLabel, formatDateUZ } from "@/lib/format";
import { isAvto, omborMatn } from "@/lib/biznesTuri";
import { todayDateOnlyString } from "@/lib/date";
import type { ProductKassirDTO, SaleDTO, BugungiSotuvStat } from "@/lib/queries/inventory";
import type { AccountDTO } from "@/lib/queries/accounts";
import { SotuvBekorModal } from "./SotuvBekorModal";
import { SotuvForm } from "./SotuvForm";

export function SotuvClient({
  products,
  initialSales,
  stat,
  biznesTuri = "umumiy",
  optom = false,
  bekorQilaOladi = false,
  kassalar = [],
}: {
  products: ProductKassirDTO[];
  initialSales: SaleDTO[];
  /** Bugungi sotuv statistikasi (serverda hisoblangan). */
  stat: BugungiSotuvStat;
  biznesTuri?: string;
  /** Optom biznes — mijoz naqd sotuvda ham majburiy. */
  optom?: boolean;
  /** Sotuvni bekor qilish faqat direktor/adminda (kassir o'z xatosini yashira olmasin). */
  bekorQilaOladi?: boolean;
  /** Faol kassalar — naqd sotuvda pul qaysi kassaga tushishini tanlash uchun. */
  kassalar?: AccountDTO[];
}) {
  const router = useRouter();
  const avto = isAvto(biznesTuri);
  const M = omborMatn(biznesTuri);
  const [sales, setSales] = useState(initialSales);
  const [bekorId, setBekorId] = useState<string | null>(null);
  const bugun = todayDateOnlyString();

  // Ustun ta'rifi BITTA — desktop jadval ham, mobil kartochka ham shundan.
  const ustunlar: Ustun<SaleDTO>[] = [
    {
      kalit: "vaqt",
      sarlavha: "Vaqt",
      className: "whitespace-nowrap",
      // Bugungi sotuvda soat, eskilarida sana ko'rinadi.
      katak: (s) =>
        s.sana.slice(0, 10) === bugun
          ? new Date(s.vaqt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
          : formatDateUZ(new Date(s.sana)),
    },
    {
      kalit: "mijoz",
      sarlavha: "Mijoz",
      katak: (s) => (s.mijozNomi ? <span>{s.mijozNomi}</span> : <span className="text-faint">—</span>),
    },
    {
      kalit: "mahsulot",
      sarlavha: M.birlikBosh,
      katak: (s) => (
        <span className={s.bekorQilingan ? "opacity-60 line-through" : ""}>
          {s.productNomi}
          {!avto && <span className="text-faint"> × {s.miqdor}</span>}
          {s.bekorQilingan && (
            <span className="block text-2xs text-expense no-underline">
              Bekor qilindi{s.bekorSabab ? `: ${s.bekorSabab}` : ""}
            </span>
          )}
        </span>
      ),
    },
    {
      kalit: "summa",
      sarlavha: "Summa",
      raqam: true,
      className: "font-medium",
      katak: (s) => formatSomLabel(s.jamiSumma),
    },
    {
      kalit: "tolov",
      sarlavha: "To'lov",
      katak: (s) => (
        <Badge tone={s.tolovTuri === "naqd" ? "kirim" : "neutral"}>
          {s.tolovTuri === "naqd" ? "Naqd" : "Qarz"}
        </Badge>
      ),
    },
  ];

  const statlar = [
    { nomi: "Bugungi savdo", qiymat: stat.savdo, tone: "brand" as const },
    { nomi: "Sotuvlar soni", qiymat: stat.soni, dona: true },
    { nomi: "Naqd", qiymat: stat.naqd, tone: "income" as const },
    { nomi: "Qarzga", qiymat: stat.qarz, tone: "debt" as const },
  ];

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <SotuvForm
        products={products}
        biznesTuri={biznesTuri}
        kassalar={kassalar}
        optom={optom}
        onSold={(sale) => {
          setSales((prev) => [sale, ...prev]);
          router.refresh();
        }}
      />

      <Card>
        <h2 className="font-semibold text-fg mb-3">Bugungi sotuvlar</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {statlar.map((s) => (
            <div key={s.nomi} className="rounded-lg bg-surface-2 px-3 py-2.5">
              <p className="text-2xs text-muted mb-0.5">{s.nomi}</p>
              {s.dona ? (
                <p className="font-display tnum text-base text-fg">{s.qiymat}</p>
              ) : (
                <Money value={s.qiymat} size="md" tone={s.tone} suffix={false} />
              )}
            </div>
          ))}
        </div>

        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
          So&apos;nggi sotuvlar
        </p>
        <Jadval
          ustunlar={ustunlar}
          qatorlar={sales}
          kalit={(s) => s.id}
          amallar={(s) => [
            ...(!s.bekorQilingan
              ? [
                  {
                    label: "Chek",
                    href: `/api/sales/${s.id}/receipt`,
                    yangiOyna: true,
                    tur: "asosiy" as const,
                  },
                ]
              : []),
            ...(bekorQilaOladi && !s.bekorQilingan
              ? [{ label: "Bekor qilish", onClick: () => setBekorId(s.id), tur: "xavf" as const }]
              : []),
          ]}
          bosh={
            <EmptyState
              title="Hali sotuv yo'q"
              description="Birinchi sotuvni chap tomondagi forma orqali kiriting."
            />
          }
        />
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
