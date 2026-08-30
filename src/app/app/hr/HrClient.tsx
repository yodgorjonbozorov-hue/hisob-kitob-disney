"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { STAVKA_NOMI, type StavkaTuri } from "@/lib/validation/hr";
import { shiftMonthString } from "@/lib/date";
import type { XodimDTO, OylikDTO, HrStats } from "@/lib/queries/hr";
import type { XodimlarPerformanceDTO } from "@/lib/queries/xodimPlan";
import { XodimModal } from "./XodimModal";
import { PerformancePanel } from "./PerformancePanel";
import { OylikModal, AvansModal } from "./OylikModal";

const HOLAT_TONE: Record<string, "kirim" | "chiqim" | "neutral"> = {
  hisoblanmagan: "neutral",
  qoralama: "neutral",
  tolangan: "kirim",
};
const HOLAT_NOMI: Record<string, string> = {
  hisoblanmagan: "Hisoblanmagan",
  qoralama: "Qoralama",
  tolangan: "To'langan",
};

export function HrClient({
  xodimlar,
  oyliklar,
  stats,
  performance,
  oy,
  initialTab = "oylik",
  basePath = "/app/hr",
}: {
  xodimlar: XodimDTO[];
  oyliklar: OylikDTO[];
  stats: HrStats;
  performance: XodimlarPerformanceDTO;
  oy: string;
  initialTab?: "oylik" | "xodimlar";
  basePath?: string;
}) {
  const router = useRouter();
  const [xodimModal, setXodimModal] = useState<XodimDTO | "yangi" | null>(null);
  const [oylikModal, setOylikModal] = useState<OylikDTO | null>(null);
  const [avansModal, setAvansModal] = useState<OylikDTO | null>(null);
  const [amal, setAmal] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [tab, setTab] = useState<"oylik" | "xodimlar">(initialTab);

  function oyniOzgart(delta: number) {
    router.push(`${basePath}?oy=${shiftMonthString(oy, delta)}`);
  }

  async function tola(payrollId: string) {
    setAmal(payrollId);
    setXato(null);
    try {
      const res = await fetch(`/api/hr/oylik/${payrollId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-muted text-sm mb-1">Faol xodim</p>
          <p className="text-2xl font-bold text-fg tnum">{stats.faolXodim}</p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">To&apos;lanadigan ({oy})</p>
          <Money value={stats.tolanadigan} size="xl" tone="expense" />
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">To&apos;langan ({oy})</p>
          <Money value={stats.tolangan} size="xl" tone="neutral" />
          <p className="text-2xs text-faint mt-1">oylik + avans</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={tab === "oylik" ? "primary" : "secondary"} onClick={() => setTab("oylik")}>
            Oylik vedomosti
          </Button>
          <Button size="sm" variant={tab === "xodimlar" ? "primary" : "secondary"} onClick={() => setTab("xodimlar")}>
            Xodimlar ({xodimlar.length})
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" variant="ghost" onClick={() => oyniOzgart(-1)}>
            ←
          </Button>
          <span className="text-sm text-fg tnum">{oy}</span>
          <Button size="sm" variant="ghost" onClick={() => oyniOzgart(1)}>
            →
          </Button>
          <Button size="sm" onClick={() => setXodimModal("yangi")}>
            Yangi xodim
          </Button>
        </div>
      </div>

      {xato && <p className="text-sm text-expense">{xato}</p>}

      {tab === "xodimlar" && (
        <PerformancePanel
          performance={performance}
          xodimlar={xodimlar}
          onTahrir={(x) => setXodimModal(x)}
          onYangi={() => setXodimModal("yangi")}
        />
      )}

      {tab === "oylik" && (
        <Card>
          {oyliklar.length === 0 ? (
            <EmptyState
              icon="👷"
              title="Faol xodim yo'q"
              description="Oylik vedomosti faol xodimlar ro'yxatidan tuziladi. Avval xodim qo'shing."
              action={<Button onClick={() => setXodimModal("yangi")}>Xodim qo&apos;shish</Button>}
            />
          ) : (
            <div className="jadval-siljish">
              <table className="w-full text-sm min-w-[34rem]">
                <thead>
                  <tr className="text-left text-faint text-xs uppercase">
                    <th className="pb-2">Xodim</th>
                    <th className="pb-2 text-right">Asos</th>
                    <th className="pb-2 text-right">Avans</th>
                    <th className="pb-2 text-right">To&apos;lanadigan</th>
                    <th className="pb-2">Holat</th>
                    <th className="pb-2 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {oyliklar.map((o) => (
                    <tr key={o.employeeId}>
                      <td className="py-2.5 font-medium">
                        {o.xodimIsm}
                        <span className="block text-2xs text-faint">
                          {STAVKA_NOMI[o.stavkaTuri as StavkaTuri] ?? o.stavkaTuri}:{" "}
                          {o.stavka.toLocaleString("uz-UZ")}
                          {o.stavkaTuri === "kunlik" && ` · ${o.yarimKunlar / 2} kun`}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tnum">
                        {o.hisoblangan.toLocaleString("uz-UZ")}
                        {(o.qoshimcha > 0 || o.ushlab > 0 || o.bonuslar > 0 || o.jarimalar > 0) && (
                          <span className="block text-2xs text-faint">
                            {o.qoshimcha + o.bonuslar > 0 &&
                              `+${(o.qoshimcha + o.bonuslar).toLocaleString("uz-UZ")}`}
                            {o.ushlab + o.jarimalar > 0 &&
                              ` −${(o.ushlab + o.jarimalar).toLocaleString("uz-UZ")}`}
                            {o.jarimalar > 0 && " (jarima)"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right tnum">
                        {o.avans > 0 ? o.avans.toLocaleString("uz-UZ") : <span className="text-faint">—</span>}
                      </td>
                      <td className="py-2.5 text-right">
                        <Money value={o.tolanadigan} size="sm" tone={o.tolanadigan > 0 ? "expense" : "neutral"} />
                      </td>
                      <td className="py-2.5">
                        <Badge tone={HOLAT_TONE[o.holat] ?? "neutral"}>
                          {HOLAT_NOMI[o.holat] ?? o.holat}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap gap-1 justify-end">
                          {o.holat !== "tolangan" && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => setOylikModal(o)}>
                                Hisoblash
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setAvansModal(o)}>
                                Avans
                              </Button>
                            </>
                          )}
                          {o.holat === "qoralama" && o.id && o.tolanadigan > 0 && (
                            <Button size="sm" loading={amal === o.id} onClick={() => tola(o.id!)}>
                              To&apos;lash
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {xodimModal && (
        <XodimModal
          xodim={xodimModal === "yangi" ? null : xodimModal}
          onClose={() => setXodimModal(null)}
          onDone={() => {
            setXodimModal(null);
            router.refresh();
          }}
        />
      )}
      {oylikModal && (
        <OylikModal
          qator={oylikModal}
          oy={oy}
          onClose={() => setOylikModal(null)}
          onDone={() => {
            setOylikModal(null);
            router.refresh();
          }}
        />
      )}
      {avansModal && (
        <AvansModal
          qator={avansModal}
          oy={oy}
          onClose={() => setAvansModal(null)}
          onDone={() => {
            setAvansModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
