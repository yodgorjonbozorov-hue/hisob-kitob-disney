import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatToshkentVaqt } from "@/lib/format";
import { HOLAT_NOMI, TURI_NOMI } from "@/lib/validation/kassirKassa";
import type { TopshiriqDTO } from "@/lib/queries/kassirKassa";

/** Holat -> Badge rangi. */
const HOLAT_TONE: Record<string, "kirim" | "chiqim" | "warning" | "neutral"> = {
  qabul: "kirim",
  rad: "chiqim",
  kutilmoqda: "warning",
  bekor: "neutral",
};

/**
 * KASSA TARIXI — barcha topshiriq va pul berishlar.
 * Tarix HECH QACHON o'chirilmaydi (talab 23): rad etilgan va bekor qilingan
 * yozuvlar ham ro'yxatda qoladi.
 */
export function KassaTarix({
  tarix,
  sarlavha = "Kassa tarixi",
  kassirKorsatilsin = false,
}: {
  tarix: TopshiriqDTO[];
  sarlavha?: string;
  kassirKorsatilsin?: boolean;
}) {
  return (
    <Card>
      <h2 className="font-semibold text-fg mb-3">{sarlavha}</h2>
      {tarix.length === 0 ? (
        <EmptyState title="Hali topshiriq yo'q" description="Kassa topshirilganda shu yerda ko'rinadi." icon="🧾" />
      ) : (
        <div className="divide-y divide-line">
          {tarix.map((t) => (
            <div key={t.id} className="py-3 space-y-1">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-fg">
                    {TURI_NOMI[t.turi] ?? t.turi}
                  </span>
                  {kassirKorsatilsin && (
                    <span className="text-sm text-muted">· {t.kassirIsm ?? "—"}</span>
                  )}
                  <Badge tone={HOLAT_TONE[t.holat] ?? "neutral"}>
                    {HOLAT_NOMI[t.holat] ?? t.holat}
                  </Badge>
                </div>
                <Money value={t.topshirilgan} size="sm" />
              </div>
              <p className="text-xs text-faint">
                {formatToshkentVaqt(new Date(t.topshirilganAt))}
                {t.turi === "topshirish" && ` · Hisoblangan: ${t.hisoblangan.toLocaleString("ru-RU")}`}
                {t.qabulIsm && ` · ${t.holat === "rad" ? "Rad etdi" : "Qabul qildi"}: ${t.qabulIsm}`}
              </p>
              {t.farq !== 0 && (
                <p className="text-xs">
                  <span className={t.farq < 0 ? "text-expense" : "text-debt"}>
                    {t.farq < 0 ? "Kamomad" : "Ortiqcha"}: {Math.abs(t.farq).toLocaleString("ru-RU")} so&apos;m
                  </span>
                  {t.holat === "qabul" && (
                    <span className="text-faint">
                      {" "}
                      · {t.farqYopildi ? "hisobdan chiqarildi" : "kassada ochiq qoldi"}
                    </span>
                  )}
                </p>
              )}
              {(t.izoh || t.qarorIzoh) && (
                <p className="text-xs text-muted">
                  {t.izoh}
                  {t.izoh && t.qarorIzoh ? " · " : ""}
                  {t.qarorIzoh}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
