"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/Select";
import { formatSom, parseSomInput } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import type { KassirQoldiqDTO } from "@/lib/queries/kassirKassa";

/**
 * KASSIRLAR KASSASI — kimning qo'lida qancha naqd bor.
 *
 * Bu raqamlar biznes kassalari (Account) qoldig'idan ALOHIDA: u yerda pul
 * qaysi hisob-raqamda ekani, bu yerda esa KIMNING qo'lida ekani ko'rsatiladi.
 * Ikkalasi bir-birini almashtirmaydi.
 */
export function KassirlarPaneli({
  kassirlar,
  userlar,
}: {
  kassirlar: KassirQoldiqDTO[];
  userlar: { id: string; ism: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [berish, setBerish] = useState(false);
  const [kassirId, setKassirId] = useState(userlar[0]?.id ?? "");
  const [summaText, setSummaText] = useState("");
  const [izoh, setIzoh] = useState("");
  const [yuborilmoqda, setYuborilmoqda] = useState(false);

  const jami = kassirlar.reduce((a, k) => a + k.qoldiq, 0);

  async function pulBer() {
    const summa = parseSomInput(summaText);
    if (!kassirId || summa <= 0) {
      toast({ message: "Kassir va summani kiriting", tone: "error" });
      return;
    }
    setYuborilmoqda(true);
    try {
      const res = await fetch("/api/kassa-topshirish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turi: "berish", kassirId, summa, izoh: izoh.trim() || undefined }),
      });
      if (!res.ok) {
        toast({ message: (await res.json()).error ?? "Berib bo'lmadi", tone: "error" });
        return;
      }
      toast({ message: "Kassaga pul berildi", tone: "success" });
      setBerish(false);
      setSummaText("");
      setIzoh("");
      router.refresh();
    } finally {
      setYuborilmoqda(false);
    }
  }

  return (
    <Card>
      <Modal open={berish} onClose={() => setBerish(false)} title="Kassaga pul berish">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-fg" htmlFor="berish-kassir">
              Kassir
            </label>
            <Select
              id="berish-kassir"
              value={kassirId}
              onChange={setKassirId}
              searchable={userlar.length > 7}
              options={userlar.map((u) => ({ value: u.id, label: u.ism }))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-fg" htmlFor="berish-summa">
              Summa (so&apos;m)
            </label>
            <input
              id="berish-summa"
              inputMode="numeric"
              value={summaText}
              onChange={(e) => setSummaText(formatSom(parseSomInput(e.target.value)))}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-fg tnum"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-fg" htmlFor="berish-izoh">
              Izoh (ixtiyoriy)
            </label>
            <input
              id="berish-izoh"
              value={izoh}
              onChange={(e) => setIzoh(e.target.value)}
              maxLength={300}
              placeholder="Masalan: qaytim uchun boshlang'ich pul"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-fg"
            />
          </div>
          <p className="text-xs text-faint">
            Bu chiqim EMAS — pul biznes ichida kassirning qo&apos;liga o&apos;tadi. Hisobotlar
            o&apos;zgarmaydi.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setBerish(false)}>
              Bekor qilish
            </Button>
            <Button onClick={pulBer} loading={yuborilmoqda}>
              Berish
            </Button>
          </div>
        </div>
      </Modal>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="font-semibold text-fg">Kassirlar kassasi</h2>
          <p className="text-xs text-faint">
            Hali topshirilmagan naqd: <Money value={jami} size="sm" />
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setBerish(true)} disabled={userlar.length === 0}>
          Kassaga pul berish
        </Button>
      </div>

      {kassirlar.length === 0 ? (
        <p className="text-sm text-faint">Hali hech kimda kassa harakati yo&apos;q.</p>
      ) : (
        <div className="divide-y divide-line">
          {kassirlar.map((k) => (
            <div key={k.kassirId} className="py-2.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-fg">{k.kassirIsm}</p>
                <div className="mt-0.5">
                  <Badge tone={k.ochiq ? "warning" : "neutral"}>
                    {k.ochiq ? "Ochiq" : "Yopilgan"}
                  </Badge>
                  {k.kutilayotganSumma > 0 && (
                    <span className="text-xs text-faint ml-2">
                      {k.kutilayotganSumma.toLocaleString("ru-RU")} so&apos;m tasdiq kutmoqda
                    </span>
                  )}
                </div>
              </div>
              <Money
                value={k.qoldiq}
                size="md"
                tone={k.qoldiq > 0 ? "brand" : k.qoldiq < 0 ? "expense" : "neutral"}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
