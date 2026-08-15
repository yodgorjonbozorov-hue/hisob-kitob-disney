"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateUZ } from "@/lib/format";
import { HOLAT_NOMI, TOLOV_HOLAT_NOMI, type TolovHolat, type XaridHolat } from "@/lib/validation/xarid";
import type { OrderDTO, SupplierDTO, XaridStats } from "@/lib/queries/xarid";
import type { ProductAdminDTO } from "@/lib/queries/inventory";
import { BuyurtmaModal } from "./BuyurtmaModal";
import { QabulModal } from "./QabulModal";

const HOLAT_TONE: Record<string, "kirim" | "chiqim" | "neutral"> = {
  qoralama: "neutral",
  tasdiqlangan: "neutral",
  qabul_qilingan: "kirim",
  bekor: "chiqim",
};

/** To'lov holati — tovar holati yonida alohida nishon (Paid/Partially/Debt). */
const TOLOV_TONE: Record<TolovHolat, "kirim" | "chiqim" | "neutral"> = {
  qoralama: "neutral",
  kutilmoqda: "neutral",
  tolangan: "kirim",
  qisman: "neutral",
  qarz: "chiqim",
  bekor: "neutral",
};

export function XaridClient({
  orders,
  suppliers,
  products,
  stats,
  omborli,
  pro,
}: {
  orders: OrderDTO[];
  suppliers: SupplierDTO[];
  products: ProductAdminDTO[];
  stats: XaridStats;
  omborli: boolean;
  /** PRO: qabulda qisman to'lov modali; PRO'siz — eski bir bosishli qabul. */
  pro: boolean;
}) {
  const router = useRouter();
  const [yangiOpen, setYangiOpen] = useState(false);
  const [ochiq, setOchiq] = useState<string | null>(null);
  const [amal, setAmal] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [qabulOrder, setQabulOrder] = useState<OrderDTO | null>(null);

  // PRO'siz mijozda "qabul_qilingan" ham shu yerdan yuboriladi (eski xatti-harakat:
  // naqd → to'liq chiqim, qarz → to'liq qarz); PRO'da qabul QabulModal orqali.
  async function holatOzgartir(orderId: string, holat: "tasdiqlangan" | "qabul_qilingan" | "bekor") {
    setAmal(orderId);
    setXato(null);
    try {
      const res = await fetch(`/api/xarid/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holat }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setAmal(null);
    }
  }

  if (!omborli) {
    return (
      <Card>
        <EmptyState
          icon="📦"
          title="Ombor tizimi yoqilmagan"
          description="Xarid tovar bilan ishlaydi. Avval biznes sozlamalarida ombor tizimini yoqing."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-muted text-sm mb-1">Ochiq buyurtmalar</p>
          <p className="text-2xl font-bold text-fg tnum">{stats.ochiqBuyurtma}</p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Joriy oy xaridi</p>
          <Money value={stats.oylikXarid} size="xl" tone="expense" />
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Ta&apos;minotchilar</p>
          <p className="text-2xl font-bold text-fg tnum">{stats.taminotchiSoni}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <Link href="/app/xarid/taminotchilar">
          <Button variant="secondary">Ta&apos;minotchilar</Button>
        </Link>
        <Button onClick={() => setYangiOpen(true)} disabled={suppliers.length === 0 || products.length === 0}>
          Yangi buyurtma
        </Button>
      </div>

      {(suppliers.length === 0 || products.length === 0) && (
        <p className="text-2xs text-faint text-right">
          Buyurtma uchun kamida bitta ta&apos;minotchi va bitta mahsulot kerak.
        </p>
      )}

      {xato && <p className="text-sm text-expense">{xato}</p>}

      <Card>
        {orders.length === 0 ? (
          <EmptyState
            icon="🚚"
            title="Hali xarid buyurtmasi yo'q"
            description="Buyurtma qoralama sifatida yaratiladi; qabul qilinganda tovar omborga tushadi va chiqim yoki ta'minotchiga qarz avtomatik yoziladi."
          />
        ) : (
          <div className="space-y-2">
            {orders.map((o) => {
              const yoyilgan = ochiq === o.id;
              return (
                <div key={o.id} className="border border-line rounded-xl">
                  <button
                    type="button"
                    onClick={() => setOchiq(yoyilgan ? null : o.id)}
                    className="w-full text-left p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-fg truncate">{o.supplierNomi}</p>
                      <p className="text-2xs text-faint">
                        {formatDateUZ(new Date(o.sana))} · {o.satrlar.length} satr ·{" "}
                        {o.tolovTuri === "naqd" ? "Naqd" : "Qarzga"}
                        {o.qabulSana && ` · qabul: ${formatDateUZ(new Date(o.qabulSana))}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Money value={o.jamiSumma} size="md" tone="neutral" />
                      <Badge tone={HOLAT_TONE[o.holat] ?? "neutral"}>
                        {HOLAT_NOMI[o.holat as XaridHolat] ?? o.holat}
                      </Badge>
                      {/* Tovar holati "qabul qilingan" bo'lganda pul holati alohida
                          ko'rsatiladi — qolgan holatlarda ikkalasi bir xil bo'lardi. */}
                      {o.holat === "qabul_qilingan" && (
                        <Badge tone={TOLOV_TONE[o.tolovHolati]}>{TOLOV_HOLAT_NOMI[o.tolovHolati]}</Badge>
                      )}
                    </div>
                  </button>

                  {yoyilgan && (
                    <div className="border-t border-line p-3 space-y-3">
                      <table className="w-full text-2xs">
                        <thead className="text-faint uppercase text-left">
                          <tr>
                            <th className="pb-1">Mahsulot</th>
                            <th className="pb-1 text-right">Miqdor</th>
                            <th className="pb-1 text-right">Narx</th>
                            <th className="pb-1 text-right">Jami</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {o.satrlar.map((s) => (
                            <tr key={s.productId}>
                              <td className="py-1">{s.productNomi}</td>
                              <td className="py-1 text-right tnum">
                                {s.miqdor} {s.birlik}
                              </td>
                              <td className="py-1 text-right tnum">{s.birlikNarx.toLocaleString("uz-UZ")}</td>
                              <td className="py-1 text-right tnum">{s.jamiSumma.toLocaleString("uz-UZ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {o.izoh && <p className="text-2xs text-muted">{o.izoh}</p>}

                      <div className="flex flex-wrap gap-2">
                        {o.holat === "qoralama" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={amal === o.id}
                            onClick={() => holatOzgartir(o.id, "tasdiqlangan")}
                          >
                            Tasdiqlash
                          </Button>
                        )}
                        {(o.holat === "qoralama" || o.holat === "tasdiqlangan") && (
                          <>
                            <Button
                              size="sm"
                              loading={amal === o.id}
                              onClick={() => (pro ? setQabulOrder(o) : holatOzgartir(o.id, "qabul_qilingan"))}
                            >
                              Qabul qilish
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={amal === o.id}
                              onClick={() => holatOzgartir(o.id, "bekor")}
                            >
                              Bekor qilish
                            </Button>
                          </>
                        )}
                        {o.holat === "qabul_qilingan" && (
                          <p className="text-2xs text-muted">
                            {/* tolanganSumma > 0 — yangi (qisman to'lovli) yozuv; 0 bo'lsa eski
                                yozuv: to'lov holati tolovTuri'dan o'qiladi (naqd = to'liq to'langan). */}
                            Tovar omborga tushgan
                            {o.tolanganSumma > 0
                              ? ` · to'landi: ${o.tolanganSumma.toLocaleString("uz-UZ")} so'm` +
                                (o.jamiSumma - o.tolanganSumma > 0
                                  ? ` · qarz: ${(o.jamiSumma - o.tolanganSumma).toLocaleString("uz-UZ")} so'm`
                                  : "")
                              : `, ${o.tolovTuri === "naqd" ? "chiqim" : "ta'minotchiga qarz"} yozilgan`}{" "}
                            — o&apos;zgartirib bo&apos;lmaydi.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {yangiOpen && (
        <BuyurtmaModal
          suppliers={suppliers}
          products={products}
          onClose={() => setYangiOpen(false)}
          onDone={() => {
            setYangiOpen(false);
            router.refresh();
          }}
        />
      )}

      {qabulOrder && (
        <QabulModal
          order={qabulOrder}
          onClose={() => setQabulOrder(null)}
          onDone={() => {
            setQabulOrder(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
