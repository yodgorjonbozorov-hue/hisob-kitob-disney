"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatToshkentSoat } from "@/lib/format";
import type { TelegramHolatDTO } from "@/lib/queries/mijozTelegram";

/**
 * BUYURTMA KARTOCHKASIDAGI TELEGRAM HOLATI (spec 15).
 *
 * Uch holat ATAYLAB ajratilgan:
 *   ⚪ Telegram ulanmagan — mijoz botga ulanmagan, yuboriladigan manzil YO'Q.
 *                          Bu XATO EMAS, shuning uchun "Qayta yuborish"
 *                          tugmasi ham chiqmaydi (u baribir ishlamasdi).
 *   ✅ Yuborildi — soati bilan; o'zgartirish yuborilgan bo'lsa versiyasi ham.
 *   ⚠️ Yuborilmadi — Telegram qabul qilmadi. Direktorda "Qayta yuborish".
 */
export function TelegramHolat({
  holat,
  mijozUlangan,
  chekId,
  saleId,
  qaytaYubora,
}: {
  holat: TelegramHolatDTO;
  mijozUlangan: boolean;
  chekId?: string;
  saleId?: string;
  /** Faqat direktor/admin qayta yuboradi. */
  qaytaYubora: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function qaytaYubor() {
    setBusy(true);
    setXato(null);
    try {
      const res = await fetch("/api/telegram/mijoz-xabar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chekId ? { chekId } : { saleId }),
      });
      const data = await res.json();
      if (!res.ok) setXato(data.error ?? "Yuborilmadi");
      else router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  if (!mijozUlangan) {
    return (
      <p className="text-2xs text-faint">
        Telegram: <span className="text-muted">⚪ ulanmagan</span>
      </p>
    );
  }

  const yuborildi = holat.holat === "YUBORILDI";
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-2xs text-faint">Telegram:</span>
      {yuborildi ? (
        <Badge tone="kirim">
          ✅ Yuborildi
          {holat.sentAt ? ` — ${formatToshkentSoat(new Date(holat.sentAt))}` : ""}
          {holat.versiya && holat.versiya > 1 ? ` (v${holat.versiya})` : ""}
        </Badge>
      ) : (
        <Badge tone="chiqim">⚠️ Yuborilmadi</Badge>
      )}
      {qaytaYubora && (
        <Button variant="secondary" size="sm" onClick={qaytaYubor} loading={busy}>
          Qayta yuborish
        </Button>
      )}
      {xato && <span className="text-2xs text-expense-fg">{xato}</span>}
    </div>
  );
}
