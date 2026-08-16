"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { useToast } from "@/components/ui/Toast";
import type { TopshiriqDTO } from "@/lib/queries/kassirKassa";

/**
 * KASSA TOPSHIRIG'INI QABUL QILISH.
 *
 * Farq bo'lmasa — oddiy tasdiq. Farq bo'lsa direktor uni ATAYLAB hal qilishi
 * kerak (talab 12 dagi "xavfsiz default"): kamomad hisobdan chiqarilsinmi
 * (kassa 0 ga tushadi) yoki kassirning kassasida ochiq qarz bo'lib qolsinmi.
 * Ortiqchada tanlov yo'q — u har doim kassaga kiritiladi, aks holda kassa
 * qoldig'i manfiy bo'lib qolardi.
 */
export function QarorModal({
  topshiriq,
  onClose,
  onDone,
}: {
  topshiriq: TopshiriqDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const kamomad = topshiriq.farq < 0;
  const [farqYopildi, setFarqYopildi] = useState(!kamomad);
  const [qarorIzoh, setQarorIzoh] = useState("");
  const [yuborilmoqda, setYuborilmoqda] = useState(false);

  const qolgan = kamomad && !farqYopildi ? -topshiriq.farq : 0;

  async function qabulQil() {
    setYuborilmoqda(true);
    try {
      const res = await fetch(`/api/kassa-topshirish/${topshiriq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amal: "qabul",
          farqYopildi,
          qarorIzoh: qarorIzoh.trim() || undefined,
        }),
      });
      if (!res.ok) {
        toast({ message: (await res.json()).error ?? "Qabul qilib bo'lmadi", tone: "error" });
        return;
      }
      toast({ message: "Kassa topshirig'i qabul qilindi", tone: "success" });
      onDone();
    } catch {
      toast({ message: "Serverga ulanib bo'lmadi", tone: "error" });
    } finally {
      setYuborilmoqda(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Kassa topshirig'ini qabul qilish">
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted">Kassir</span>
            <span className="text-sm font-medium text-fg">{topshiriq.kassirIsm ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted">Tizim hisoblagan</span>
            <Money value={topshiriq.hisoblangan} size="sm" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted">Topshirilgan</span>
            <Money value={topshiriq.topshirilgan} size="sm" tone="brand" />
          </div>
          {topshiriq.farq !== 0 && (
            <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-line">
              <span className={`text-sm font-medium ${kamomad ? "text-expense" : "text-debt"}`}>
                {kamomad ? "Kamomad" : "Ortiqcha"}
              </span>
              <Money
                value={Math.abs(topshiriq.farq)}
                size="sm"
                tone={kamomad ? "expense" : "debt"}
              />
            </div>
          )}
        </div>

        {kamomad && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-fg">Kamomad bilan nima qilinsin?</p>
            <label className="flex items-start gap-2 text-sm text-muted cursor-pointer">
              <input
                type="radio"
                name="kamomad"
                checked={!farqYopildi}
                onChange={() => setFarqYopildi(false)}
                className="mt-1"
              />
              <span>
                Kassirda ochiq qolsin — kassasida{" "}
                <Money value={-topshiriq.farq} size="sm" /> qarz bo&apos;lib turadi.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-muted cursor-pointer">
              <input
                type="radio"
                name="kamomad"
                checked={farqYopildi}
                onChange={() => setFarqYopildi(true)}
                className="mt-1"
              />
              <span>Hisobdan chiqarilsin — kassir kassasi 0 ga tushadi.</span>
            </label>
          </div>
        )}

        {!kamomad && topshiriq.farq > 0 && (
          <p className="text-sm text-muted">
            Ortiqcha pul kassaga kiritiladi va kassir kassasi 0 ga tushadi.
          </p>
        )}

        <div className="space-y-1">
          <label className="block text-sm font-medium text-fg" htmlFor="qaror-izoh">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="qaror-izoh"
            value={qarorIzoh}
            onChange={(e) => setQarorIzoh(e.target.value)}
            maxLength={300}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-fg"
          />
        </div>

        <p className="text-xs text-faint">
          Qabul qilish kirim, chiqim va sof balansni o&apos;zgartirmaydi — o&apos;zgaradigan
          yagona narsa kassirning kassa qoldig&apos;i
          {qolgan > 0 ? ` (kamomad ${qolgan.toLocaleString("ru-RU")} so'm ochiq qoladi).` : "."}
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button onClick={qabulQil} loading={yuborilmoqda}>
            Qabul qilish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
