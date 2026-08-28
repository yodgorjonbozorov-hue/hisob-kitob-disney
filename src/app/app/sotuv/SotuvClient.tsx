"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Jadval, type Ustun } from "@/components/ui/Jadval";
import { formatSomLabel, formatDateUZ } from "@/lib/format";
import { isAvto, omborMatn } from "@/lib/biznesTuri";
import type { ProductKassirDTO, SaleDTO } from "@/lib/queries/inventory";
import type { AccountDTO } from "@/lib/queries/accounts";
import { SotuvBekorModal } from "./SotuvBekorModal";
import { SotuvForm } from "./SotuvForm";

export function SotuvClient({
  products,
  initialSales,
  biznesTuri = "umumiy",
  bekorQilaOladi = false,
  kassalar = [],
}: {
  products: ProductKassirDTO[];
  initialSales: SaleDTO[];
  biznesTuri?: string;
  /** Sotuvni bekor qilish faqat direktor/adminda (kassir o'z xatosini yashira olmasin). */
  bekorQilaOladi?: boolean;
  /** MIJOZLAR moduli yoqiq bo'lsa — qarz limiti ishlaydigan mijoz kartochkalari. */
  /** Faol kassalar — naqd sotuvda pul qaysi kassaga tushishini tanlash uchun. */
  kassalar?: AccountDTO[];
}) {
  const router = useRouter();
  const avto = isAvto(biznesTuri);
  const M = omborMatn(biznesTuri);
  const [sales, setSales] = useState(initialSales);
  const [bekorId, setBekorId] = useState<string | null>(null);

  // Ustun ta'rifi BITTA — desktop jadval ham, mobil kartochka ham shundan.
  const ustunlar: Ustun<SaleDTO>[] = [
    {
      kalit: "sana",
      sarlavha: "Sana",
      className: "whitespace-nowrap",
      katak: (s) => formatDateUZ(new Date(s.sana)),
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

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SotuvForm
        products={products}
        biznesTuri={biznesTuri}
        kassalar={kassalar}
        onSold={(sale) => {
          setSales((prev) => [sale, ...prev]);
          router.refresh();
        }}
      />

      <Card>
        <h2 className="font-semibold text-fg mb-3">So&apos;nggi sotuvlar</h2>
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
          bosh={<p className="text-center text-faint py-6 text-sm">Hali sotuv yo&apos;q</p>}
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
