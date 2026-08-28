"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { daqiqaMatn } from "@/lib/davomat/vaqt";
import type { DavomatHisobotDTO } from "@/lib/queries/davomat";

type Davr = "kun" | "hafta" | "oy";

function davrOraligi(davr: Davr): { from: string; to: string } {
  const MS = 24 * 60 * 60 * 1000;
  const TOSHKENT = 5 * 60 * 60 * 1000;
  const bugunT = new Date(Date.now() + TOSHKENT);
  const to = bugunT.toISOString().slice(0, 10);
  if (davr === "kun") return { from: to, to };
  if (davr === "hafta") {
    return { from: new Date(bugunT.getTime() - 6 * MS).toISOString().slice(0, 10), to };
  }
  return { from: `${to.slice(0, 7)}-01`, to };
}

/** Davr bo'yicha davomat metrikalari (kunlik/haftalik/oylik hisobot). */
export function HisobotBlok() {
  const [davr, setDavr] = useState<Davr>("hafta");
  const [data, setData] = useState<DavomatHisobotDTO | null>(null);

  useEffect(() => {
    let bekor = false;
    setData(null);
    const { from, to } = davrOraligi(davr);
    fetch(`/api/hr/davomat/hisobot?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!bekor) setData(d);
      })
      .catch(() => undefined);
    return () => {
      bekor = true;
    };
  }, [davr]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="font-bold text-fg">Davomat hisoboti</p>
        <Segmented
          options={[
            { value: "kun", label: "Bugun" },
            { value: "hafta", label: "Hafta" },
            { value: "oy", label: "Oy" },
          ]}
          value={davr}
          onChange={setDavr}
        />
      </div>
      {!data ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
          <div>
            <p className="text-2xl font-bold text-fg tnum">{data.davomatFoiz}%</p>
            <p className="text-2xs text-muted">Davomat ({data.keldi}/{data.ishKunYozuvlari})</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-debt tnum">{data.kechikdi}</p>
            <p className="text-2xs text-muted">Kechikish · {daqiqaMatn(data.jamiKechikishDaqiqa)}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-expense tnum">{data.kelmadi}</p>
            <p className="text-2xs text-muted">Kelmagan kun</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-fg tnum">
              {Math.round(data.jamiIshlanganDaqiqa / 60)}
            </p>
            <p className="text-2xs text-muted">
              Ishlangan soat · ortiqcha {daqiqaMatn(data.jamiOrtiqchaDaqiqa)}
            </p>
          </div>
          <div className="col-span-2 flex items-center gap-6 pt-2 border-t border-line">
            <div>
              <Money value={data.tasdiqlanganJarima} size="sm" tone="expense" />
              <p className="text-2xs text-muted">Tasdiqlangan jarima</p>
            </div>
            <div>
              <Money value={data.kutilayotganJarima} size="sm" tone="debt" />
              <p className="text-2xs text-muted">Kutilmoqda</p>
            </div>
            <div>
              <Money value={data.bonuslar} size="sm" tone="income" />
              <p className="text-2xs text-muted">Bonuslar</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
