"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatToshkentVaqt } from "@/lib/format";
import type { KassaHolatDTO, TopshiriqDTO } from "@/lib/queries/kassirKassa";
import { KassaTarix } from "@/components/kassa/KassaTarix";
import { TopshirishModal } from "./TopshirishModal";

/**
 * "MENING KASSAM" kartasi.
 *
 * Eng katta raqam — KASSADAGI QOLDIQ (talab 2): kassir har lahzada
 * qo'lida qancha pul borligini ko'rib turishi kerak, aks holda "menda
 * yo'q edi" bahsi paydo bo'ladi.
 */
export function KassamClient({
  holat,
  tarix,
}: {
  holat: KassaHolatDTO;
  tarix: TopshiriqDTO[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [modal, setModal] = useState(false);
  const [bekorlanmoqda, setBekorlanmoqda] = useState(false);

  const kutilayotgan = holat.kutilayotgan;

  async function bekorQil() {
    if (!kutilayotgan) return;
    if (!confirm("Topshiriq bekor qilinsinmi? Pul kassangizda qoladi.")) return;
    setBekorlanmoqda(true);
    try {
      const res = await fetch(`/api/kassa-topshirish/${kutilayotgan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amal: "bekor" }),
      });
      if (!res.ok) {
        toast({ message: (await res.json()).error ?? "Bekor qilib bo'lmadi", tone: "error" });
        return;
      }
      toast({ message: "Topshiriq bekor qilindi", tone: "success" });
      router.refresh();
    } finally {
      setBekorlanmoqda(false);
    }
  }

  const qator = (label: string, value: number, tone?: "income" | "expense") => (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-muted">{label}</span>
      <Money value={value} size="sm" tone={tone} />
    </div>
  );

  return (
    <div className="space-y-6">
      {modal && (
        <TopshirishModal
          qoldiq={holat.qoldiq}
          onClose={() => setModal(false)}
          onDone={() => {
            setModal(false);
            router.refresh();
          }}
        />
      )}

      <Card className="border-brand/30">
        <p className="text-sm text-muted">Kassadagi qoldiq</p>
        <div className="mt-1">
          <Money
            value={holat.qoldiq}
            size="display"
            tone={holat.qoldiq > 0 ? "brand" : holat.qoldiq < 0 ? "expense" : "neutral"}
          />
        </div>
        <p className="text-xs text-faint mt-2">
          Tizim hisoblagan summa. Kirim/chiqim hisobotlari bundan o&apos;zgarmaydi.
        </p>

        <div className="mt-4 pt-4 border-t border-line">
          {qator("Kun boshidagi qoldiq", holat.boshlangich)}
          {qator("Bugungi kirim (naqd)", holat.bugungiKirim, "income")}
          {qator("Bugungi chiqim (naqd)", holat.bugungiChiqim, "expense")}
          {holat.bugunBerilgan > 0 && qator("Bugun kassaga berildi", holat.bugunBerilgan, "income")}
          {holat.bugunTopshirilgan > 0 &&
            qator("Bugun topshirildi", holat.bugunTopshirilgan, "expense")}
        </div>

        {kutilayotgan ? (
          <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone="warning">Tasdiq kutilmoqda</Badge>
              <span className="text-xs text-faint">
                {formatToshkentVaqt(new Date(kutilayotgan.topshirilganAt))}
              </span>
            </div>
            <p className="text-sm text-muted">
              Topshirildi: <Money value={kutilayotgan.topshirilgan} size="sm" /> — direktor qabul
              qilgach kassangiz yangilanadi.
            </p>
            {kutilayotgan.farq !== 0 && (
              <p className="text-sm">
                <span className={kutilayotgan.farq < 0 ? "text-expense" : "text-debt"}>
                  {kutilayotgan.farq < 0 ? "Kamomad" : "Ortiqcha"}:{" "}
                </span>
                <Money value={Math.abs(kutilayotgan.farq)} size="sm" />
              </p>
            )}
            <Button variant="secondary" size="sm" onClick={bekorQil} loading={bekorlanmoqda}>
              Topshiriqni bekor qilish
            </Button>
          </div>
        ) : (
          <div className="mt-5">
            <Button
              size="lg"
              className="w-full"
              onClick={() => setModal(true)}
              disabled={holat.qoldiq <= 0}
            >
              KASSANI TOPSHIRISH
            </Button>
            {holat.qoldiq <= 0 && (
              <p className="text-xs text-faint mt-2 text-center">
                {holat.qoldiq === 0
                  ? "Kassangiz bo'sh — topshiriladigan pul yo'q."
                  : "Kassangizda kamomad bor. Direktor bilan bog'laning."}
              </p>
            )}
          </div>
        )}
      </Card>

      {holat.qoldiq > 0 && !kutilayotgan && (
        <Card className="border-debt/40">
          <p className="font-medium text-fg">Kassangiz hali yopilmagan</p>
          <p className="text-sm text-muted mt-1">
            Kassangizda <Money value={holat.qoldiq} size="sm" /> bor. Kun oxirida uni
            direktor/qabul qiluvchiga topshirishingiz kerak.
          </p>
        </Card>
      )}

      <KassaTarix tarix={tarix} />
    </div>
  );
}
