"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { shiftMonthString, parseMonthString } from "@/lib/date";
import { DAVOMAT_HOLATLARI, DAVOMAT_NOMI, type DavomatHolat } from "@/lib/validation/hr";
import type { DavomatDTO } from "@/lib/queries/hr";

/** Har holat uchun bitta harf va rang — jadval tor ekranda ham o'qiladi. */
const BELGI: Record<DavomatHolat, { harf: string; klass: string }> = {
  keldi: { harf: "K", klass: "bg-income-soft text-income-fg" },
  yarim: { harf: "Y", klass: "bg-debt-soft text-debt-fg" },
  kelmadi: { harf: "—", klass: "bg-expense-soft text-expense-fg" },
  tatil: { harf: "T", klass: "bg-surface-2 text-muted" },
};

export function DavomatClient({ davomat, oy }: { davomat: DavomatDTO; oy: string }) {
  const router = useRouter();
  const [belgi, setBelgi] = useState<DavomatHolat>("keldi");
  const [amal, setAmal] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  // Optimistik ko'rinish: bosilgan katak javobni kutmasdan o'zgaradi.
  const [ozgargan, setOzgargan] = useState<Record<string, DavomatHolat>>({});

  const { year, monthIndex0 } = parseMonthString(oy);
  const kunSoni = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  const kunlar = useMemo(() => Array.from({ length: kunSoni }, (_, i) => i + 1), [kunSoni]);

  const xarita = useMemo(() => {
    const m: Record<string, DavomatHolat> = {};
    for (const k of davomat.kunlar) m[`${k.employeeId}:${k.sana}`] = k.holat as DavomatHolat;
    return m;
  }, [davomat.kunlar]);

  function sanaKalit(employeeId: string, kun: number) {
    const kk = String(kun).padStart(2, "0");
    return `${employeeId}:${oy}-${kk}`;
  }

  async function bosildi(employeeId: string, kun: number) {
    const kalit = sanaKalit(employeeId, kun);
    const sana = kalit.split(":")[1];
    setAmal(kalit);
    setXato(null);
    setOzgargan((p) => ({ ...p, [kalit]: belgi }));
    try {
      const res = await fetch("/api/hr/davomat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, sana, holat: belgi }),
      });
      if (!res.ok) {
        const data = await res.json();
        setXato(data.error ?? "Xatolik yuz berdi");
        // Optimistik o'zgarish orqaga qaytariladi.
        setOzgargan((p) => {
          const n = { ...p };
          delete n[kalit];
          return n;
        });
      }
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setAmal(null);
    }
  }

  if (davomat.xodimlar.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="📅"
          title="Faol xodim yo'q"
          description="Davomat jadvali faol xodimlar ro'yxatidan tuziladi."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-1">
          {DAVOMAT_HOLATLARI.map((h) => (
            <Button
              key={h}
              size="sm"
              variant={belgi === h ? "primary" : "secondary"}
              onClick={() => setBelgi(h)}
            >
              {DAVOMAT_NOMI[h]}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <Button size="sm" variant="ghost" onClick={() => router.push(`/app/hr/davomat?oy=${shiftMonthString(oy, -1)}`)}>
            ←
          </Button>
          <span className="text-sm text-fg tnum">{oy}</span>
          <Button size="sm" variant="ghost" onClick={() => router.push(`/app/hr/davomat?oy=${shiftMonthString(oy, 1)}`)}>
            →
          </Button>
        </div>
      </div>

      <p className="text-2xs text-faint">
        Yuqoridan belgini tanlang, so&apos;ng jadvaldagi kataklarni bosing. Bosilgan katak shu
        belgi bilan yoziladi (qayta bossangiz ustiga yoziladi).
      </p>

      {xato && <p className="text-sm text-expense">{xato}</p>}

      <Card>
        <div className="overflow-x-auto">
          <table className="text-2xs">
            <thead>
              <tr className="text-faint uppercase">
                <th className="sticky left-0 bg-surface px-2 py-1 text-left">Xodim</th>
                {kunlar.map((k) => (
                  <th key={k} className="px-1 py-1 tnum w-7">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {davomat.xodimlar.map((x) => (
                <tr key={x.id}>
                  <td className="sticky left-0 bg-surface px-2 py-1 whitespace-nowrap font-medium text-fg">
                    {x.ism}
                  </td>
                  {kunlar.map((k) => {
                    const kalit = sanaKalit(x.id, k);
                    const holat = ozgargan[kalit] ?? xarita[kalit];
                    const b = holat ? BELGI[holat] : null;
                    return (
                      <td key={k} className="p-0.5">
                        <button
                          type="button"
                          onClick={() => bosildi(x.id, k)}
                          disabled={amal === kalit}
                          aria-label={`${x.ism} ${oy}-${String(k).padStart(2, "0")}`}
                          className={`w-6 h-6 rounded ${b ? b.klass : "bg-surface-2 text-faint"} hover:ring-1 hover:ring-brand`}
                        >
                          {b ? b.harf : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
