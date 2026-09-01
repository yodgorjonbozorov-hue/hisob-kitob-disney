"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatSom } from "@/lib/format";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";

/**
 * SOTUV BONUSI (32-talab) — CRM → sotuvchi → puli kelgan sotuv → bonus →
 * oylik zanjirining oxirgi halqasi.
 *
 * Bonus summasi QO'LDA yozilmaydi: u "puli kelgan sotuv" dan foiz sifatida
 * hisoblanadi va mavjud `EmployeeBonus` yozuvi sifatida saqlanadi — o'sha
 * yozuv oylik vedomostiga (`Payroll.bonuslar`) o'z-o'zidan tushadi, ya'ni
 * ikkinchi bonus tizimi yaratilmaydi.
 *
 * QARZGA SOTILGAN ZAKAZ BONUSGA KIRMAYDI: baza faqat to'liq to'langan
 * zakazlardan yig'iladi (17/18-talab).
 */
export function SotuvBonusKarta({
  employeeId,
  ism,
  bonusAsosi,
  /** Davr oxiri — bonus shu sana bilan yoziladi. */
  sana,
  davrMatni,
}: {
  employeeId: string;
  ism: string;
  bonusAsosi: number;
  sana: string;
  davrMatni: string;
}) {
  const router = useRouter();
  const [foiz, setFoiz] = useState("5");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [natija, setNatija] = useState<string | null>(null);

  const foizSoni = Number(foiz.replace(",", "."));
  const togri = Number.isFinite(foizSoni) && foizSoni > 0 && foizSoni <= 100;
  // Pul har doim Int (so'm) — kasr bo'lmaydi (CLAUDE.md).
  const summa = togri ? Math.round((bonusAsosi * foizSoni) / 100) : 0;

  async function yozish() {
    setLoading(true);
    setXato(null);
    setNatija(null);
    const res = await fetch("/api/hr/bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        sana,
        summa,
        sabab: `Sotuv bonusi (${davrMatni}) — ${foizSoni}%`,
        izoh: `Puli kelgan sotuv: ${bonusAsosi} so'm`,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Bonus yozilmadi");
      return;
    }
    setNatija(`${ism} uchun ${formatSom(summa)} so'm bonus yozildi — oylik vedomostida ko'rinadi.`);
    router.refresh();
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-bold text-fg">Sotuv bonusi</p>
        <p className="text-2xs text-muted">
          Baza — puli kelgan sotuv: <span className="tnum">{formatSom(bonusAsosi)} so&apos;m</span>.
          Qarzi yopilmagan zakazlar bazaga kirmaydi.
        </p>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <label className="space-y-1">
          <span className="block text-xs text-muted">Bonus foizi</span>
          <input
            value={foiz}
            onChange={(e) => setFoiz(e.target.value)}
            inputMode="decimal"
            className={`${INPUT_CLASS} w-24`}
            aria-label="Bonus foizi"
          />
        </label>
        <div className="space-y-1">
          <span className="block text-xs text-muted">Bonus summasi</span>
          <p className="text-lg font-bold text-brand tnum">{formatSom(summa)} so&apos;m</p>
        </div>
        <Button onClick={yozish} disabled={loading || !togri || summa <= 0} size="sm">
          {loading ? "Yozilmoqda..." : "Bonus yozish"}
        </Button>
      </div>

      {xato && <p className="text-expense text-sm">{xato}</p>}
      {natija && <p className="text-income text-sm">{natija}</p>}
    </Card>
  );
}
