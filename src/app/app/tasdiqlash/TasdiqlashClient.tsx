"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateUZ } from "@/lib/format";
import { TASDIQ_HOLAT_NOMI, type TasdiqHolat } from "@/lib/validation/approval";
import type { RequestDTO, TasdiqStats } from "@/lib/queries/approval";
import { RadModal } from "./RadModal";

const HOLAT_TONE: Record<string, "kirim" | "chiqim" | "neutral"> = {
  kutilmoqda: "neutral",
  tasdiqlangan: "kirim",
  rad: "chiqim",
};

export function TasdiqlashClient({
  sorovlar,
  stats,
  boshqaruvchi,
  meId,
}: {
  sorovlar: RequestDTO[];
  stats: TasdiqStats;
  boshqaruvchi: boolean;
  meId: string;
}) {
  const router = useRouter();
  const [amal, setAmal] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [radId, setRadId] = useState<string | null>(null);
  const [filtr, setFiltr] = useState<"kutilmoqda" | "hammasi">("kutilmoqda");

  async function tasdiqla(id: string) {
    setAmal(id);
    setXato(null);
    try {
      const res = await fetch(`/api/tasdiqlash/sorovlar/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qaror: "tasdiq" }),
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

  const korinadigan =
    filtr === "kutilmoqda" ? sorovlar.filter((s) => s.holat === "kutilmoqda") : sorovlar;

  return (
    <div className="space-y-4">
      {boshqaruvchi && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <p className="text-muted text-sm mb-1">Qaror kutayotgan so&apos;rovlar</p>
            <p className="text-2xl font-bold text-fg tnum">{stats.kutilmoqda}</p>
          </Card>
          <Card>
            <p className="text-muted text-sm mb-1">Kutayotgan summa</p>
            <Money value={stats.kutilmoqdaSumma} size="xl" tone="expense" />
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          size="sm"
          variant={filtr === "kutilmoqda" ? "primary" : "secondary"}
          onClick={() => setFiltr("kutilmoqda")}
        >
          Kutilmoqda
        </Button>
        <Button
          size="sm"
          variant={filtr === "hammasi" ? "primary" : "secondary"}
          onClick={() => setFiltr("hammasi")}
        >
          Hammasi
        </Button>
      </div>

      {xato && <p className="text-sm text-expense">{xato}</p>}

      <Card>
        {korinadigan.length === 0 ? (
          <EmptyState
            icon="✅"
            title={filtr === "kutilmoqda" ? "Qaror kutayotgan so'rov yo'q" : "Hali so'rov yo'q"}
            description="Chegaradan oshgan chiqim kiritilganda so'rov shu yerda paydo bo'ladi va tasdiqlovchiga Telegramga xabar ketadi."
          />
        ) : (
          <div className="space-y-2">
            {korinadigan.map((s) => (
              <div key={s.id} className="border border-line rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-fg truncate">{s.kategoriyaNomi}</p>
                    <p className="text-2xs text-faint">
                      {formatDateUZ(new Date(s.sana))} · {s.sorovchiIsm}
                      {s.kassaNomi && ` · ${s.kassaNomi}`}
                      {s.filial && ` · ${s.filial}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money value={s.summa} size="md" tone="expense" />
                    <Badge tone={HOLAT_TONE[s.holat] ?? "neutral"}>
                      {TASDIQ_HOLAT_NOMI[s.holat as TasdiqHolat] ?? s.holat}
                    </Badge>
                  </div>
                </div>

                {s.izoh && <p className="text-2xs text-muted">{s.izoh}</p>}

                {s.holat === "rad" && s.radSabab && (
                  <p className="text-2xs text-expense">
                    Rad sababi: {s.radSabab}
                    {s.tasdiqlovchiIsm && ` — ${s.tasdiqlovchiIsm}`}
                  </p>
                )}
                {s.holat === "tasdiqlangan" && (
                  <p className="text-2xs text-income">
                    Tasdiqlandi{s.tasdiqlovchiIsm && ` — ${s.tasdiqlovchiIsm}`}, chiqim yozuvi
                    yaratildi.
                  </p>
                )}

                {s.holat === "kutilmoqda" && boshqaruvchi && s.sorovchiId !== meId && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" loading={amal === s.id} onClick={() => tasdiqla(s.id)}>
                      Tasdiqlash
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRadId(s.id)}>
                      Rad etish
                    </Button>
                  </div>
                )}
                {s.holat === "kutilmoqda" && boshqaruvchi && s.sorovchiId === meId && (
                  <p className="text-2xs text-faint">
                    O&apos;z so&apos;rovingizni o&apos;zingiz tasdiqlay olmaysiz — boshqa
                    rahbar qaror qiladi.
                  </p>
                )}
                {s.holat === "kutilmoqda" && !boshqaruvchi && (
                  <p className="text-2xs text-faint">Rahbar qarori kutilmoqda.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {radId && (
        <RadModal
          requestId={radId}
          onClose={() => setRadId(null)}
          onDone={() => {
            setRadId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
