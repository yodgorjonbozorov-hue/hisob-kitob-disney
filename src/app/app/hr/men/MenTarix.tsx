"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { daqiqaMatn } from "@/lib/davomat/vaqt";
import type { TarixYozuvDTO, JarimaDTO, BonusDTO } from "@/lib/queries/davomat";
import { JARIMA_HOLAT_NOMI, type JarimaHolat } from "@/lib/validation/davomat";

interface OylikQator {
  oy: string;
  hisoblangan: number;
  qoshimcha: number;
  ushlab: number;
  bonuslar: number;
  jarimalar: number;
  avans: number;
  tolanadigan: number;
  holat: string;
}

interface TarixJavobi {
  xodim: { id: string; ism: string } | null;
  tarix: TarixYozuvDTO[];
  jarimalar: JarimaDTO[];
  bonuslar: BonusDTO[];
  oylikOchiq: boolean;
  oyliklar: OylikQator[];
}

const HOLAT_BELGI: Record<string, { matn: string; tone: "kirim" | "chiqim" | "neutral" | "warning" }> = {
  keldi: { matn: "Keldi", tone: "kirim" },
  yarim: { matn: "Yarim kun", tone: "warning" },
  kelmadi: { matn: "Kelmadi", tone: "chiqim" },
  tatil: { matn: "Ta'til", tone: "neutral" },
};

/** Xodimning shu oydagi o'z davomat tarixi, jarima/bonuslari va (ruxsat bo'lsa) oyligi. */
export function MenTarix() {
  const [data, setData] = useState<TarixJavobi | null>(null);
  const [xato, setXato] = useState(false);

  useEffect(() => {
    let bekor = false;
    fetch("/api/hr/men/tarix")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!bekor) setData(d);
      })
      .catch(() => {
        if (!bekor) setXato(true);
      });
    return () => {
      bekor = true;
    };
  }, []);

  if (xato) return null;
  if (!data) return <Skeleton className="h-32" />;
  if (!data.xodim) return null;

  return (
    <div className="space-y-4">
      <Card>
        <p className="font-bold text-fg mb-2">Shu oy — davomatim</p>
        {data.tarix.length === 0 ? (
          <p className="text-sm text-muted">Hali yozuv yo&apos;q.</p>
        ) : (
          <div className="space-y-2">
            {data.tarix.map((t) => {
              const b = HOLAT_BELGI[t.holat] ?? HOLAT_BELGI.keldi;
              return (
                <div key={t.id} className="flex items-center justify-between text-sm border-b border-line pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-fg tnum">{t.sana}</p>
                    <p className="text-2xs text-muted tnum">
                      {t.kelgan ? `${t.kelgan}${t.ketgan ? ` → ${t.ketgan}` : " → ishda"}` : "—"}
                      {t.jarimaDaqiqa > 0 && (
                        <span className="text-expense"> · {t.kechikishDaqiqa} daq kechikish</span>
                      )}
                    </p>
                  </div>
                  <Badge tone={b.tone}>{b.matn}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {(data.jarimalar.length > 0 || data.bonuslar.length > 0) && (
        <Card>
          <p className="font-bold text-fg mb-2">Jarima va bonuslarim</p>
          <div className="space-y-2">
            {data.jarimalar.map((j) => (
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
            {data.bonuslar.map((b) => (
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

      {data.oylikOchiq && data.oyliklar.length > 0 && (
        <Card>
          <p className="font-bold text-fg mb-2">Oyligim</p>
          <div className="space-y-3">
            {data.oyliklar.map((o) => (
              <div key={o.oy} className="text-sm">
                <div className="flex items-center justify-between">
                  <p className="text-fg font-medium tnum">{o.oy}</p>
                  <Money value={o.tolanadigan} size="md" tone="brand" />
                </div>
                <p className="text-2xs text-muted mt-1">
                  Asos {o.hisoblangan.toLocaleString("uz")} · bonus +{(o.qoshimcha + o.bonuslar).toLocaleString("uz")} · jarima −{(o.ushlab + o.jarimalar).toLocaleString("uz")} · avans −{o.avans.toLocaleString("uz")} ·{" "}
                  {o.holat === "tolangan" ? "to'langan" : "hisoblanmoqda"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-2xs text-faint text-center pb-4">
        Ishlangan vaqt {data.tarix.length > 0 ? daqiqaMatn(data.tarix.reduce((a, t) => a + t.ishlanganDaqiqa, 0)) : "0 daqiqa"} · selfie va lokatsiya faqat davomat tasdig&apos;i uchun ishlatiladi
      </p>
    </div>
  );
}
