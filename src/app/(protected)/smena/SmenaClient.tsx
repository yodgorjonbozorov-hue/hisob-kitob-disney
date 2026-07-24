"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatSom, formatSomLabel, parseSomInput, formatDateUZ } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import type { ShiftCloseDTO } from "@/lib/queries/shift";

export function SmenaClient({
  today,
  kutilgan,
  recent,
}: {
  today: string;
  kutilgan: number;
  recent: ShiftCloseDTO[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [sanalgan, setSanalgan] = useState("");
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);

  const sanalganNum = parseSomInput(sanalgan);
  const farq = sanalganNum - kutilgan;

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/shift-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sana: today, sanalganNaqd: sanalganNum, izoh: izoh || undefined }),
      });
      if (res.ok) {
        toast({ message: "Kun yopildi", tone: "success" });
        setSanalgan("");
        setIzoh("");
        router.refresh();
      } else {
        toast({ message: (await res.json()).error ?? "Xatolik", tone: "error" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-muted text-sm mb-1">Kutilgan naqd (bugun)</p>
            <p className="text-xl font-semibold tnum text-fg">{formatSomLabel(kutilgan)}</p>
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">Sanalgan naqd</label>
            <input
              type="text"
              inputMode="numeric"
              value={sanalgan}
              onChange={(e) => setSanalgan(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
              placeholder="0"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-lg tnum"
            />
          </div>
          <div>
            <p className="text-muted text-sm mb-1">Farq</p>
            <p className={`text-xl font-semibold tnum ${farq === 0 ? "text-fg" : farq > 0 ? "text-income" : "text-expense"}`}>
              {sanalgan ? (farq > 0 ? "+" : "") + formatSomLabel(farq) : "—"}
            </p>
          </div>
        </div>
        <input
          type="text"
          value={izoh}
          onChange={(e) => setIzoh(e.target.value)}
          placeholder="Izoh (masalan: kam/ortiq sabab)"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm mb-3"
        />
        <Button onClick={submit} loading={loading} disabled={!sanalgan} size="lg">
          Kunni yopish
        </Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        <h2 className="font-semibold text-fg px-5 pt-5 pb-3">So'nggi kun yakunlari</h2>
        <div className="divide-y divide-line">
          {recent.length === 0 && <p className="text-center text-faint py-6 text-sm">Hali yozuv yo'q</p>}
          {recent.map((s) => (
            <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-fg">{formatDateUZ(new Date(s.sana))}</p>
                <p className="text-xs text-muted tnum">
                  Kutilgan {formatSomLabel(s.kutilganNaqd)} · Sanalgan {formatSomLabel(s.sanalganNaqd)}
                  {s.userIsm ? ` · ${s.userIsm}` : ""}
                </p>
              </div>
              <Badge tone={s.farq === 0 ? "kirim" : s.farq > 0 ? "info" : "chiqim"}>
                {s.farq === 0 ? "Teng" : (s.farq > 0 ? "+" : "") + formatSom(s.farq)}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
