"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatSomLabel, formatDateUZ } from "@/lib/format";
import { isAvto, omborMatn } from "@/lib/biznesTuri";
import type { ProductKassirDTO, SaleDTO } from "@/lib/queries/inventory";
import type { MijozDTO } from "@/lib/queries/mijoz";
import type { AccountDTO } from "@/lib/queries/accounts";
import { SotuvBekorModal } from "./SotuvBekorModal";
import { SotuvForm } from "./SotuvForm";

export function SotuvClient({
  products,
  initialSales,
  biznesTuri = "umumiy",
  bekorQilaOladi = false,
  mijozlar = [],
  kassalar = [],
}: {
  products: ProductKassirDTO[];
  initialSales: SaleDTO[];
  biznesTuri?: string;
  /** Sotuvni bekor qilish faqat direktor/adminda (kassir o'z xatosini yashira olmasin). */
  bekorQilaOladi?: boolean;
  /** MIJOZLAR moduli yoqiq bo'lsa — qarz limiti ishlaydigan mijoz kartochkalari. */
  mijozlar?: MijozDTO[];
  /** Faol kassalar — naqd sotuvda pul qaysi kassaga tushishini tanlash uchun. */
  kassalar?: AccountDTO[];
}) {
  const router = useRouter();
  const avto = isAvto(biznesTuri);
  const M = omborMatn(biznesTuri);
  const [sales, setSales] = useState(initialSales);
  const [bekorId, setBekorId] = useState<string | null>(null);

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SotuvForm
        products={products}
        biznesTuri={biznesTuri}
        mijozlar={mijozlar}
        kassalar={kassalar}
        onSold={(sale) => {
          setSales((prev) => [sale, ...prev]);
          router.refresh();
        }}
      />

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
