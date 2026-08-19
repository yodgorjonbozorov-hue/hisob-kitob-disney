"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateUZ } from "@/lib/format";
import type { MijozKartochka } from "@/lib/queries/mijoz";
import { MijozModal } from "../MijozModal";

type Tab = "sotuv" | "qarz" | "bitim";

export function KartochkaClient({
  kartochka,
  boshqaruvchi,
}: {
  kartochka: MijozKartochka;
  boshqaruvchi: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("sotuv");
  const [tahrirOpen, setTahrirOpen] = useState(false);
  const { mijoz, sotuvlar, qarzlar, bitimlar } = kartochka;

  const tablar: { key: Tab; label: string; soni: number }[] = [
    { key: "sotuv", label: "Sotuvlar", soni: sotuvlar.length },
    { key: "qarz", label: "Qarzlar", soni: qarzlar.length },
    { key: "bitim", label: "Bitimlar", soni: bitimlar.length },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-muted text-sm mb-1">Jami sotuv</p>
          <Money value={mijoz.jamiSotuv} size="xl" tone="income" />
          <p className="text-2xs text-faint mt-1">{mijoz.sotuvSoni} ta sotuv</p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Ochiq qarz</p>
          <Money value={mijoz.ochiqQarz} size="xl" tone="expense" />
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Qarz limiti</p>
          {mijoz.qarzLimit === null ? (
            <p className="text-2xl font-bold text-faint">chegarasiz</p>
          ) : (
            <>
              <Money value={mijoz.qarzLimit} size="xl" tone="neutral" />
              <p className={`text-2xs mt-1 ${mijoz.limitToldi ? "text-expense" : "text-faint"}`}>
                {mijoz.limitToldi
                  ? "Limit to'ldi — yangi qarzga sotuv rad etiladi"
                  : `${(mijoz.qarzLimit - mijoz.ochiqQarz).toLocaleString("uz-UZ")} so'm joy qolgan`}
              </p>
            </>
          )}
        </Card>
      </div>

      {mijoz.izoh && <p className="text-sm text-muted">{mijoz.izoh}</p>}

      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          {tablar.map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={tab === t.key ? "primary" : "secondary"}
              onClick={() => setTab(t.key)}
            >
              {t.label} ({t.soni})
            </Button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setTahrirOpen(true)}>
          Tahrirlash
        </Button>
      </div>

      <Card>
        {tab === "sotuv" &&
          (sotuvlar.length === 0 ? (
            <EmptyState icon="🧾" title="Sotuv yo'q" description="Bu mijozga hali sotuv yozilmagan." />
          ) : (
            <div className="jadval-siljish">
              <table className="w-full text-sm min-w-[34rem]">
                <thead>
                  <tr className="text-left text-faint text-xs uppercase">
                    <th className="pb-2">Sana</th>
                    <th className="pb-2">Mahsulot</th>
                    <th className="pb-2 text-right">Miqdor</th>
                    <th className="pb-2 text-right">Summa</th>
                    <th className="pb-2">To&apos;lov</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sotuvlar.map((s) => (
                    <tr key={s.id} className={s.bekor ? "opacity-50 line-through" : ""}>
                      <td className="py-2.5">{formatDateUZ(new Date(s.sana))}</td>
                      <td className="py-2.5">{s.mahsulot}</td>
                      <td className="py-2.5 text-right tnum">{s.miqdor}</td>
                      <td className="py-2.5 text-right">
                        <Money value={s.jamiSumma} size="sm" tone="neutral" />
                      </td>
                      <td className="py-2.5">
                        <Badge tone={s.tolovTuri === "naqd" ? "kirim" : "neutral"}>
                          {s.tolovTuri === "naqd" ? "Naqd" : "Qarz"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "qarz" &&
          (qarzlar.length === 0 ? (
            <EmptyState icon="🤝" title="Qarz yo'q" description="Bu mijozda qarz yozuvi yo'q." />
          ) : (
            <div className="jadval-siljish">
              <table className="w-full text-sm min-w-[32rem]">
                <thead>
                  <tr className="text-left text-faint text-xs uppercase">
                    <th className="pb-2">Sana</th>
                    <th className="pb-2 text-right">Jami</th>
                    <th className="pb-2 text-right">To&apos;langan</th>
                    <th className="pb-2 text-right">Qoldiq</th>
                    <th className="pb-2">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {qarzlar.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2.5">
                        {formatDateUZ(new Date(d.sana))}
                        {d.muddat && (
                          <span className="block text-2xs text-faint">
                            muddat: {formatDateUZ(new Date(d.muddat))}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right tnum">{d.jamiSumma.toLocaleString("uz-UZ")}</td>
                      <td className="py-2.5 text-right tnum">{d.tolangan.toLocaleString("uz-UZ")}</td>
                      <td className="py-2.5 text-right">
                        <Money value={d.qoldiq} size="sm" tone={d.qoldiq > 0 ? "expense" : "neutral"} />
                      </td>
                      <td className="py-2.5">
                        <Badge tone={d.isYopilgan ? "kirim" : "chiqim"}>
                          {d.isYopilgan ? "Yopilgan" : "Ochiq"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "bitim" &&
          (bitimlar.length === 0 ? (
            <EmptyState
              icon="📈"
              title="Bitim yo'q"
              description="CRM modulida bu mijozga bitim ochilmagan."
            />
          ) : (
            <div className="space-y-2">
              {bitimlar.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 py-1">
                  <div className="min-w-0">
                    <p className="font-medium text-fg truncate">{b.nomi}</p>
                    <p className="text-2xs text-faint">{b.bosqich}</p>
                  </div>
                  <Money value={b.summa} size="sm" tone="neutral" />
                </div>
              ))}
            </div>
          ))}
      </Card>

      {tahrirOpen && (
        <MijozModal
          mijoz={mijoz}
          boshqaruvchi={boshqaruvchi}
          onClose={() => setTahrirOpen(false)}
          onDone={() => {
            setTahrirOpen(false);
            router.refresh();
          }}
          // O'chirilgan mijoz kartochkasi endi mavjud emas — ro'yxatga qaytamiz.
          onDeleted={() => router.push("/app/mijozlar")}
        />
      )}
    </div>
  );
}
