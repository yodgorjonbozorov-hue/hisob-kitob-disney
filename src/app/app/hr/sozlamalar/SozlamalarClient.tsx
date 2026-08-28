"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { QOIDA_TURI_NOMI, type QoidaTuri } from "@/lib/validation/davomat";
import { IshJoyiModal, type IshJoyiDTO } from "./IshJoyiModal";
import { QoidaModal, type QoidaDTO } from "./QoidaModal";

export function SozlamalarClient({
  joylar,
  qoidalar,
  xodimOylikKoradi,
}: {
  joylar: IshJoyiDTO[];
  qoidalar: QoidaDTO[];
  xodimOylikKoradi: boolean;
}) {
  const router = useRouter();
  const [joyModal, setJoyModal] = useState<IshJoyiDTO | "yangi" | null>(null);
  const [qoidaModal, setQoidaModal] = useState<QoidaDTO | "yangi" | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [amal, setAmal] = useState<string | null>(null);

  async function sorov(url: string, method: string, body?: unknown) {
    setXato(null);
    setAmal(url);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
    <div className="space-y-6">
      {xato && <div className="rounded-xl bg-expense-soft text-expense text-sm p-3">{xato}</div>}

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-bold text-fg">Ish joylari (GPS)</p>
            <p className="text-2xs text-muted">
              Check-in shu nuqta radiusi ichida qabul qilinadi — tekshiruv serverda.
            </p>
          </div>
          <Button size="sm" onClick={() => setJoyModal("yangi")}>
            + Ish joyi
          </Button>
        </div>
        {joylar.length === 0 ? (
          <EmptyState
            title="Ish joyi belgilanmagan"
            description="Radius tekshiruvi ishlashi uchun kamida bitta nuqta kiriting."
          />
        ) : (
          joylar.map((j) => (
            <div
              key={j.id}
              className="flex items-center justify-between gap-2 py-2.5 border-b border-line last:border-0"
            >
              <div>
                <p className="font-medium text-fg">
                  {j.nomi} {j.standart && <Badge tone="info">Standart</Badge>}{" "}
                  {!j.isActive && <Badge tone="neutral">Faol emas</Badge>}
                </p>
                <p className="text-2xs text-muted tnum">
                  {j.lat.toFixed(5)}, {j.lng.toFixed(5)} · radius {j.radiusM} m
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setJoyModal(j)}>
                  Tahrirlash
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={amal === `/api/hr/ish-joyi/${j.id}`}
                  onClick={() => {
                    if (window.confirm("Ish joyi o'chirilsinmi?")) {
                      void sorov(`/api/hr/ish-joyi/${j.id}`, "DELETE");
                    }
                  }}
                >
                  O&apos;chirish
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-bold text-fg">Jarima qoidalari</p>
            <p className="text-2xs text-muted">
              Kechikish daqiqasiga qarab jarima avtomatik ochiladi (tasdiqlash bilan kuchga kiradi).
            </p>
          </div>
          <Button size="sm" onClick={() => setQoidaModal("yangi")}>
            + Qoida
          </Button>
        </div>
        {qoidalar.length === 0 ? (
          <EmptyState
            title="Qoidalar yo'q"
            description="Namuna: 6-15 daqiqa 20 ming, 16-30 daqiqa 50 ming, 31+ daqiqa 100 ming, kelmagan kun 200 ming. Keyin xohlagancha tahrirlaysiz."
            action={
              <Button
                loading={amal === "/api/hr/jarima/qoidalar"}
                onClick={() => void sorov("/api/hr/jarima/qoidalar", "POST", { standart: true })}
              >
                Namunani o&apos;rnatish
              </Button>
            }
          />
        ) : (
          qoidalar.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between gap-2 py-2.5 border-b border-line last:border-0"
            >
              <div>
                <p className="font-medium text-fg">
                  {QOIDA_TURI_NOMI[q.turi as QoidaTuri] ?? q.turi}
                  {q.turi === "kechikish" && (
                    <span className="tnum">
                      {" "}
                      {q.minDaqiqa}–{q.maxDaqiqa ?? "∞"} daqiqa
                    </span>
                  )}{" "}
                  {!q.isActive && <Badge tone="neutral">O&apos;chiq</Badge>}
                </p>
                <p className="text-2xs text-muted tnum">{q.summa.toLocaleString("uz-UZ")} so&apos;m</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setQoidaModal(q)}>
                  Tahrirlash
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Qoida o'chirilsinmi?")) {
                      void sorov(`/api/hr/jarima/qoidalar/${q.id}`, "DELETE");
                    }
                  }}
                >
                  O&apos;chirish
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card>
        <p className="font-bold text-fg mb-2">Ko&apos;rinish siyosati</p>
        <label className="flex items-center justify-between gap-3 text-sm text-fg min-h-[44px] cursor-pointer">
          <span>
            Xodim o&apos;z oyligini ko&apos;ra oladi
            <span className="block text-2xs text-muted">
              Yoqilsa xodim &quot;Davomatim&quot; sahifasida o&apos;z vedomostini ko&apos;radi.
            </span>
          </span>
          <input
            type="checkbox"
            className="w-5 h-5"
            defaultChecked={xodimOylikKoradi}
            onChange={(e) =>
              void sorov("/api/hr/sozlamalar", "PATCH", { xodimOylikKoradi: e.target.checked })
            }
          />
        </label>
      </Card>

      {joyModal && (
        <IshJoyiModal joy={joyModal === "yangi" ? null : joyModal} onYopish={() => setJoyModal(null)} />
      )}
      {qoidaModal && (
        <QoidaModal
          qoida={qoidaModal === "yangi" ? null : qoidaModal}
          onYopish={() => setQoidaModal(null)}
        />
      )}
    </div>
  );
}
