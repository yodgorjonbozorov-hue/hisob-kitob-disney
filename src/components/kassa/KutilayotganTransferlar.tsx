"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatToshkentVaqt } from "@/lib/format";
import { TRANSFER_TURI_NOMI, type TransferTuri } from "@/lib/validation/account";
import type { TransferDTO } from "@/lib/queries/accounts";

/**
 * TASDIQ KUTAYOTGAN PUL O'TKAZMALARI.
 *
 * Pul hali ko'chmagan: u yuboruvchining kassasida turibdi va qoldiqqa
 * kirmaydi (lib/services/kassaTransfer.ts). Shu sababli panel ro'yxatning
 * eng tepasida — bu harakat talab qiladigan yagona blok.
 *
 * Qabul/rad — faqat QABUL QILUVCHI (yoki boshqaruvchi); bekor — YUBORUVCHI.
 * Server ham xuddi shu qoidani mustaqil tekshiradi, bu yerdagi tugmalar
 * shunchaki keraksizini ko'rsatmaydi.
 */
export function KutilayotganTransferlar({
  transferlar,
  meniUserId,
  boshqaruvchi,
}: {
  transferlar: TransferDTO[];
  meniUserId: string;
  boshqaruvchi: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [bandId, setBandId] = useState<string | null>(null);

  if (transferlar.length === 0) return null;

  async function qaror(t: TransferDTO, amal: "qabul" | "rad" | "bekor") {
    if (amal !== "qabul") {
      const savol =
        amal === "rad"
          ? `${t.fromUserIsm ?? t.fromNomi} yuborgan ${t.summa.toLocaleString("ru-RU")} so'm rad etilsinmi?`
          : `O'tkazma bekor qilinsinmi?`;
      if (!confirm(savol)) return;
    }
    setBandId(t.id);
    try {
      const res = await fetch(`/api/kassa-transfer/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amal }),
      });
      if (!res.ok) {
        toast({ message: (await res.json()).error ?? "Bajarib bo'lmadi", tone: "error" });
        return;
      }
      toast({
        message:
          amal === "qabul"
            ? "Pul qabul qilindi — kassangizga qo'shildi"
            : amal === "rad"
              ? "O'tkazma rad etildi"
              : "O'tkazma bekor qilindi",
        tone: "success",
      });
      router.refresh();
    } finally {
      setBandId(null);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold text-fg mb-3">
        Tasdiq kutayotgan o&apos;tkazmalar ({transferlar.length})
      </h2>
      <div className="divide-y divide-line">
        {transferlar.map((t) => {
          const menga = t.toUserId === meniUserId;
          const mendan = t.fromUserId === meniUserId;
          return (
            <div key={t.id} className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-fg">
                    {t.fromUserIsm ?? t.fromNomi} → {t.toUserIsm ?? t.toNomi}
                  </p>
                  <p className="text-xs text-faint">
                    {formatToshkentVaqt(new Date(t.createdAt))} ·{" "}
                    {TRANSFER_TURI_NOMI[t.turi as TransferTuri] ?? t.turi}
                  </p>
                  {t.izoh && <p className="text-xs text-muted mt-0.5">{t.izoh}</p>}
                </div>
                <div className="text-right">
                  <Money value={t.summa} size="lg" tone="brand" />
                  <div className="mt-1">
                    <Badge tone={menga ? "warning" : "neutral"}>
                      {menga ? "Sizga yuborildi" : mendan ? "Siz yubordingiz" : "Kutilmoqda"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(menga || boshqaruvchi) && (
                  <>
                    <Button size="sm" onClick={() => qaror(t, "qabul")} disabled={bandId === t.id}>
                      Qabul qilish
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => qaror(t, "rad")}
                      loading={bandId === t.id}
                    >
                      Rad etish
                    </Button>
                  </>
                )}
                {(mendan || boshqaruvchi) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => qaror(t, "bekor")}
                    disabled={bandId === t.id}
                  >
                    Bekor qilish
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
