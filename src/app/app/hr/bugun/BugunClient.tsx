"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { daqiqaMatn } from "@/lib/davomat/vaqt";
import type { BugunDTO, BugunXodimDTO, BugunHolat } from "@/lib/queries/davomat";
import { SelfieModal } from "../SelfieModal";
import { TuzatishModal } from "../TuzatishModal";
import { HisobotBlok } from "./HisobotBlok";

const HOLAT_KORINISH: Record<BugunHolat, { matn: string; tone: "kirim" | "chiqim" | "neutral" | "warning" | "info" }> = {
  ishda: { matn: "🟢 Ishda", tone: "kirim" },
  tugatdi: { matn: "Ishni tugatgan", tone: "neutral" },
  kutilmoqda: { matn: "❌ Hali kelmagan", tone: "warning" },
  kelmadi: { matn: "Kelmadi", tone: "chiqim" },
  dam: { matn: "Dam olish", tone: "info" },
  tatil: { matn: "Ta'til", tone: "info" },
};

function StatKarta({ qiymat, label, rang }: { qiymat: number | string; label: string; rang?: string }) {
  return (
    <Card className="p-3 sm:p-4">
      <p className={`text-2xl font-bold tnum ${rang ?? "text-fg"}`}>{qiymat}</p>
      <p className="text-2xs text-muted mt-0.5">{label}</p>
    </Card>
  );
}

export function BugunClient({ bugun }: { bugun: BugunDTO }) {
  const router = useRouter();
  const [selfie, setSelfie] = useState<{ id: string; ism: string } | null>(null);
  const [tuzatish, setTuzatish] = useState<BugunXodimDTO | null>(null);

  // Panel jonli qolsin: har 60 soniyada serverdan yangilanadi.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatKarta qiymat={bugun.jami} label="Jami xodim" />
        <StatKarta qiymat={bugun.ishda} label="Ishda" rang="text-income" />
        <StatKarta qiymat={bugun.kechikdi} label="Kechikdi" rang="text-debt" />
        <StatKarta qiymat={bugun.kelmagan} label="Hali kelmadi" rang="text-expense" />
        <StatKarta qiymat={bugun.tugatdi} label="Ishni tugatdi" />
        <Card className="p-3 sm:p-4">
          <Money value={bugun.kutilayotganJarima} size="md" tone="expense" />
          <p className="text-2xs text-muted mt-0.5">Kutilayotgan jarima</p>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted tnum">Bugun — {bugun.sana}</p>
        <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
          Yangilash
        </Button>
      </div>

      {bugun.xodimlar.length === 0 ? (
        <EmptyState
          title="Xodimlar yo'q"
          description="Avval Xodimlar bo'limida xodim qo'shing."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {bugun.xodimlar.map((x) => {
            const k = HOLAT_KORINISH[x.holat];
            return (
              <Card key={x.employeeId} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/app/hr/xodim/${x.employeeId}`}
                      className="font-bold text-fg hover:text-brand truncate block"
                    >
                      {x.ism}
                    </Link>
                    <p className="text-2xs text-muted">
                      {x.lavozim ?? "—"}
                      {x.rejaBoshlanish && (
                        <span className="tnum"> · {x.rejaBoshlanish}—{x.rejaTugash}</span>
                      )}
                    </p>
                  </div>
                  <Badge tone={k.tone}>{k.matn}</Badge>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="tnum text-fg">
                    {x.kelgan ? (
                      <>
                        <span className="font-bold text-lg">{x.kelgan}</span>
                        {x.ketgan && <span className="text-muted"> → {x.ketgan}</span>}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                  <div className="text-right">
                    {x.kelgan &&
                      (x.jarimaDaqiqa > 0 ? (
                        <p className="text-expense text-2xs">🔴 {x.kechikishDaqiqa} daqiqa kechikdi</p>
                      ) : (
                        <p className="text-income text-2xs">✅ Vaqtida</p>
                      ))}
                    {x.ishlanganDaqiqa > 0 && (
                      <p className="text-2xs text-muted">{daqiqaMatn(x.ishlanganDaqiqa)}</p>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {x.kelishSelfieId && (
                    <button
                      className="text-2xs text-brand underline-offset-2 hover:underline"
                      onClick={() => setSelfie({ id: x.kelishSelfieId!, ism: x.ism })}
                    >
                      📷 Kelish selfiesi
                    </button>
                  )}
                  {x.ketishSelfieId && (
                    <button
                      className="text-2xs text-brand underline-offset-2 hover:underline"
                      onClick={() => setSelfie({ id: x.ketishSelfieId!, ism: x.ism })}
                    >
                      📷 Ketish selfiesi
                    </button>
                  )}
                  {x.masofaM != null && (
                    <span className="text-2xs text-muted">📍 {x.masofaM} m masofada</span>
                  )}
                  <button
                    className="text-2xs text-muted hover:text-fg ml-auto"
                    onClick={() => setTuzatish(x)}
                  >
                    Tuzatish
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <HisobotBlok />

      <SelfieModal
        selfieId={selfie?.id ?? null}
        sarlavha={selfie ? `${selfie.ism} — selfie` : ""}
        onYopish={() => setSelfie(null)}
      />
      {tuzatish && (
        <TuzatishModal
          ochiq
          employeeId={tuzatish.employeeId}
          ism={tuzatish.ism}
          sana={bugun.sana}
          onYopish={() => setTuzatish(null)}
        />
      )}
    </div>
  );
}
