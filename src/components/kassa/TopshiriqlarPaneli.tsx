"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatToshkentVaqt } from "@/lib/format";
import type { TopshiriqDTO } from "@/lib/queries/kassirKassa";
import { QarorModal } from "./QarorModal";

/**
 * KUTILAYOTGAN KASSA TOPSHIRIQLARI — direktor paneli.
 *
 * Qabul qilish kirim/chiqimga TEGMAYDI: u faqat kassirning kassa qoldig'ini
 * kamaytiradi (lib/services/kassirKassa.ts).
 */
export function TopshiriqlarPaneli({ topshiriqlar }: { topshiriqlar: TopshiriqDTO[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [qaror, setQaror] = useState<TopshiriqDTO | null>(null);
  const [bandId, setBandId] = useState<string | null>(null);

  async function radEt(t: TopshiriqDTO) {
    const izoh = prompt("Rad etish sababi (ixtiyoriy):") ?? undefined;
    setBandId(t.id);
    try {
      const res = await fetch(`/api/kassa-topshirish/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amal: "rad", qarorIzoh: izoh?.trim() || undefined }),
      });
      if (!res.ok) {
        toast({ message: (await res.json()).error ?? "Rad etib bo'lmadi", tone: "error" });
        return;
      }
      toast({ message: "Topshiriq rad etildi", tone: "success" });
      router.refresh();
    } finally {
      setBandId(null);
    }
  }

  return (
    <Card>
      {qaror && (
        <QarorModal
          topshiriq={qaror}
          onClose={() => setQaror(null)}
          onDone={() => {
            setQaror(null);
            router.refresh();
          }}
        />
      )}

      <h2 className="font-semibold text-fg mb-3">
        Kutilayotgan topshiriqlar ({topshiriqlar.length})
      </h2>

      {topshiriqlar.length === 0 ? (
        <p className="text-sm text-faint">Tasdiq kutayotgan kassa topshirig&apos;i yo&apos;q.</p>
      ) : (
        <div className="divide-y divide-line">
          {topshiriqlar.map((t) => (
            <div key={t.id} className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium text-fg">{t.kassirIsm ?? "—"}</p>
                  <p className="text-xs text-faint">
                    {formatToshkentVaqt(new Date(t.topshirilganAt))} · Hisoblangan:{" "}
                    {t.hisoblangan.toLocaleString("ru-RU")} so&apos;m
                  </p>
                  {t.izoh && <p className="text-xs text-muted mt-0.5">{t.izoh}</p>}
                </div>
                <div className="text-right">
                  <Money value={t.topshirilgan} size="lg" tone="brand" />
                  {t.farq !== 0 && (
                    <div className="mt-1">
                      <Badge tone={t.farq < 0 ? "chiqim" : "warning"}>
                        {t.farq < 0 ? "Kamomad" : "Ortiqcha"}:{" "}
                        {Math.abs(t.farq).toLocaleString("ru-RU")}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setQaror(t)} disabled={bandId === t.id}>
                  Qabul qilish
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => radEt(t)}
                  loading={bandId === t.id}
                >
                  Rad etish
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
