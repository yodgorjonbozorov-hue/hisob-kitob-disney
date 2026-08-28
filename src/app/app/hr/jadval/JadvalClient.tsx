"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { HAFTA_KUNLARI } from "@/lib/validation/davomat";
import { JadvalModal } from "./JadvalModal";

export interface JadvalKunDTO {
  hafta: number;
  ishKuni: boolean;
  boshlanish: string | null;
  tugash: string | null;
}

export interface JadvalDTO {
  id: string;
  nomi: string;
  imtiyozDaqiqa: number;
  standart: boolean;
  isActive: boolean;
  kunlar: JadvalKunDTO[];
  xodimlar: string[];
}

/** Kunlarni Dushanbadan boshlab ko'rsatish tartibi. */
const KUN_TARTIBI = [1, 2, 3, 4, 5, 6, 0];

export function JadvalClient({
  jadvallar,
  jadvalsizXodim,
}: {
  jadvallar: JadvalDTO[];
  jadvalsizXodim: number;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<JadvalDTO | "yangi" | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  async function ochir(id: string) {
    if (!window.confirm("Jadval o'chirilsinmi?")) return;
    setXato(null);
    const res = await fetch(`/api/hr/jadval/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setXato(data.error ?? "Xatolik yuz berdi");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {jadvalsizXodim > 0 && `${jadvalsizXodim} ta xodim standart jadvalda`}
        </p>
        <Button onClick={() => setModal("yangi")}>+ Yangi jadval</Button>
      </div>
      {xato && <div className="rounded-xl bg-expense-soft text-expense text-sm p-3">{xato}</div>}

      {jadvallar.length === 0 ? (
        <EmptyState
          title="Hali jadval yo'q"
          description={'Masalan "Ofis xodimlari: Du-Ju 09:00-18:00, Sha 09:00-14:00" jadvalini tuzing.'}
          action={<Button onClick={() => setModal("yangi")}>Jadval tuzish</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {jadvallar.map((j) => (
            <Card key={j.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-fg">
                    {j.nomi}{" "}
                    {j.standart && <Badge tone="info">Standart</Badge>}{" "}
                    {!j.isActive && <Badge tone="neutral">Faol emas</Badge>}
                  </p>
                  <p className="text-2xs text-muted mt-0.5">
                    Imtiyoz: {j.imtiyozDaqiqa} daqiqa ·{" "}
                    {j.xodimlar.length > 0
                      ? `${j.xodimlar.length} xodim: ${j.xodimlar.slice(0, 3).join(", ")}${j.xodimlar.length > 3 ? "..." : ""}`
                      : "Xodim biriktirilmagan"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setModal(j)}>
                    Tahrirlash
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void ochir(j.id)}>
                    O&apos;chirish
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {KUN_TARTIBI.map((h) => {
                  const kun = j.kunlar.find((k) => k.hafta === h);
                  return (
                    <div key={h} className="flex justify-between border-b border-line last:border-0 py-1">
                      <span className="text-muted">{HAFTA_KUNLARI[h]}</span>
                      <span className={`tnum ${kun?.ishKuni ? "text-fg" : "text-faint"}`}>
                        {kun?.ishKuni ? `${kun.boshlanish} → ${kun.tugash}` : "Dam olish"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <JadvalModal
          jadval={modal === "yangi" ? null : modal}
          onYopish={() => setModal(null)}
        />
      )}
    </div>
  );
}
