"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { daqiqaMatn } from "@/lib/davomat/vaqt";
import type { TarixYozuvDTO, JarimaDTO, BonusDTO } from "@/lib/queries/davomat";
import { JARIMA_HOLAT_NOMI, type JarimaHolat } from "@/lib/validation/davomat";
import { SelfieModal } from "../../SelfieModal";
import { TuzatishModal } from "../../TuzatishModal";
import { SiyosatKarta, type XodimSiyosatDTO } from "./SiyosatKarta";

const HOLAT_BELGI: Record<string, { matn: string; tone: "kirim" | "chiqim" | "neutral" | "warning" }> = {
  keldi: { matn: "Keldi", tone: "kirim" },
  yarim: { matn: "Yarim kun", tone: "warning" },
  kelmadi: { matn: "Kelmadi", tone: "chiqim" },
  tatil: { matn: "Ta'til", tone: "neutral" },
};

/** DAVOMAT TAB — avvalgi xodim sahifasining davomat qismi (siyosat, tarix, jarima). */
export function DavomatTab({
  xodim,
  bugun,
  tarix,
  jarimalar,
  bonuslar,
  jadvallar,
  joylar,
}: {
  xodim: XodimSiyosatDTO & { ism: string };
  bugun: string;
  tarix: TarixYozuvDTO[];
  jarimalar: JarimaDTO[];
  bonuslar: BonusDTO[];
  jadvallar: { id: string; nomi: string; standart: boolean }[];
  joylar: { id: string; nomi: string; standart: boolean }[];
}) {
  const [selfie, setSelfie] = useState<string | null>(null);
  const [tuzatishSana, setTuzatishSana] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => setTuzatishSana(bugun)}>
          Davomatni tuzatish
        </Button>
      </div>

      <SiyosatKarta xodim={xodim} jadvallar={jadvallar} joylar={joylar} />

      <Card>
        <p className="font-bold text-fg mb-2">Oxirgi 30 kun — davomat</p>
        {tarix.length === 0 ? (
          <EmptyState title="Hali davomat yozuvi yo'q" />
        ) : (
          <div className="space-y-2">
            {tarix.map((t) => {
              const b = HOLAT_BELGI[t.holat] ?? HOLAT_BELGI.keldi;
              return (
                <div key={t.id} className="border-b border-line last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-fg tnum font-medium">{t.sana}</p>
                      <p className="text-2xs text-muted tnum">
                        {t.kelgan
                          ? `${t.kelgan}${t.ketgan ? ` → ${t.ketgan} · ${daqiqaMatn(t.ishlanganDaqiqa)}` : " → hozir ishda"}`
                          : "—"}
                        {t.jarimaDaqiqa > 0 && (
                          <span className="text-expense"> · ⚠️ {t.kechikishDaqiqa} daqiqa kechikdi</span>
                        )}
                        {t.rejaBoshlanish && ` · reja ${t.rejaBoshlanish}—${t.rejaTugash}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge tone={b.tone}>{b.matn}</Badge>
                      <button
                        className="text-2xs text-muted hover:text-fg"
                        onClick={() => setTuzatishSana(t.sana)}
                      >
                        Tuzatish
                      </button>
                    </div>
                  </div>
                  {t.checks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {t.checks.map((c, i) => (
                        <span key={i} className="text-2xs text-muted bg-surface-2 rounded-lg px-2 py-0.5">
                          {c.turi === "kelish" ? "Kelish" : "Ketish"} {c.vaqt}
                          {c.manba === "admin" ? ` · admin${c.sabab ? `: ${c.sabab}` : ""}` : ""}
                          {c.masofaM != null && ` · 📍${c.masofaM} m`}
                          {c.selfieId && (
                            <button
                              className="text-brand ml-1 underline-offset-2 hover:underline"
                              onClick={() => setSelfie(c.selfieId)}
                            >
                              selfie
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {(jarimalar.length > 0 || bonuslar.length > 0) && (
        <Card>
          <p className="font-bold text-fg mb-2">Jarima va bonuslar (30 kun)</p>
          <div className="space-y-2">
            {jarimalar.map((j) => (
              <div key={j.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-fg">{j.sabab}</p>
                  <p className="text-2xs text-muted">
                    {j.sana} · {JARIMA_HOLAT_NOMI[j.holat as JarimaHolat] ?? j.holat}
                  </p>
                </div>
                <Money value={-j.summa} signed size="sm" />
              </div>
            ))}
            {bonuslar.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-fg">{b.sabab}</p>
                  <p className="text-2xs text-muted">{b.sana} · Bonus</p>
                </div>
                <Money value={b.summa} signed size="sm" />
              </div>
            ))}
          </div>
        </Card>
      )}

      <SelfieModal
        selfieId={selfie}
        sarlavha={`${xodim.ism} — selfie`}
        onYopish={() => setSelfie(null)}
      />
      {tuzatishSana && (
        <TuzatishModal
          ochiq
          employeeId={xodim.id}
          ism={xodim.ism}
          sana={tuzatishSana}
          onYopish={() => setTuzatishSana(null)}
        />
      )}
    </div>
  );
}
