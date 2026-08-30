"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  VAZIFA_HOLAT_NOMI,
  MUHIMLIK_NOMI,
  type VazifaHolat,
  type Muhimlik,
} from "@/lib/validation/hr";
import type { XodimVazifaDTO } from "@/lib/services/xodimVazifa";
import { VazifaModal } from "./VazifaModal";

const HOLAT_TONE: Record<string, "kirim" | "chiqim" | "neutral" | "warning" | "info"> = {
  OCHIQ: "info",
  JARAYONDA: "warning",
  BAJARILDI: "kirim",
  BEKOR: "neutral",
};

const HOLAT_BELGI: Record<string, string> = {
  OCHIQ: "⏳",
  JARAYONDA: "⏳",
  BAJARILDI: "✅",
  BEKOR: "🚫",
};

/**
 * VAZIFALAR TAB — vazifalar ro'yxati + progress. Boshqaruvchi rejimida
 * yaratish/tahrirlash; oddiy xodim rejimida (Davomatim) faqat o'z vazifasi
 * holatini o'zgartirish.
 */
export function VazifalarTab({
  employeeId,
  ism,
  vazifalar,
  boshqaruvchi,
}: {
  employeeId: string;
  ism: string;
  vazifalar: XodimVazifaDTO[];
  boshqaruvchi: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<XodimVazifaDTO | "yangi" | null>(null);
  const [amal, setAmal] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  const faol = vazifalar.filter((v) => v.holat !== "BEKOR");
  const bajarildi = faol.filter((v) => v.holat === "BAJARILDI").length;
  const foiz = faol.length > 0 ? Math.round((bajarildi / faol.length) * 100) : 0;
  const kechikkanlar = vazifalar.filter((v) => v.kechikkan).length;

  async function holatOzgart(id: string, holat: VazifaHolat) {
    setAmal(id);
    setXato(null);
    try {
      const res = await fetch(`/api/hr/vazifalar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holat }),
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

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-bold text-fg tnum">
              Vazifalar: {bajarildi} / {faol.length}{" "}
              <span className={foiz >= 100 ? "text-income" : "text-fg"}>· {foiz}%</span>
            </p>
            {kechikkanlar > 0 && (
              <p className="text-2xs text-expense mt-0.5">{kechikkanlar} ta kechikkan vazifa</p>
            )}
          </div>
          {boshqaruvchi && <Button size="sm" onClick={() => setModal("yangi")}>+ Vazifa</Button>}
        </div>
        <div className="h-2 mt-2 rounded-full bg-surface-2 overflow-hidden">
          <div
            className={`h-full rounded-full ${foiz >= 100 ? "bg-income" : "bg-brand"}`}
            style={{ width: `${Math.min(100, foiz)}%` }}
          />
        </div>
      </Card>

      {xato && <p className="text-sm text-expense">{xato}</p>}

      {vazifalar.length === 0 ? (
        <Card>
          <EmptyState
            icon="📌"
            title="Hali vazifa yo'q"
            action={boshqaruvchi ? <Button onClick={() => setModal("yangi")}>Birinchi vazifa</Button> : undefined}
          />
        </Card>
      ) : (
        <Card>
          <div className="space-y-3">
            {vazifalar.map((v) => (
              <div key={v.id} className="border-b border-line last:border-0 pb-3 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm text-fg ${v.holat === "BAJARILDI" ? "line-through opacity-70" : ""}`}>
                      {HOLAT_BELGI[v.holat] ?? "⏳"} {v.nomi}
                      {v.kechikkan && <span className="text-expense text-2xs"> · kechikdi</span>}
                    </p>
                    {v.izoh && <p className="text-2xs text-muted mt-0.5">{v.izoh}</p>}
                    <p className="text-2xs text-faint tnum mt-0.5">
                      {v.boshlanish && `${v.boshlanish} → `}
                      {v.muddat ? `muddat: ${v.muddat}` : "muddatsiz"}
                      {" · "}
                      {MUHIMLIK_NOMI[v.muhimlik as Muhimlik] ?? v.muhimlik}
                      {v.berganIsm && ` · berdi: ${v.berganIsm}`}
                    </p>
                  </div>
                  <Badge tone={HOLAT_TONE[v.holat] ?? "neutral"}>
                    {VAZIFA_HOLAT_NOMI[v.holat as VazifaHolat] ?? v.holat}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {v.holat === "OCHIQ" && (
                    <Button size="sm" variant="secondary" loading={amal === v.id} onClick={() => holatOzgart(v.id, "JARAYONDA")}>
                      Boshlash
                    </Button>
                  )}
                  {(v.holat === "OCHIQ" || v.holat === "JARAYONDA") && (
                    <Button size="sm" loading={amal === v.id} onClick={() => holatOzgart(v.id, "BAJARILDI")}>
                      Bajarildi
                    </Button>
                  )}
                  {boshqaruvchi && v.holat !== "BEKOR" && v.holat !== "BAJARILDI" && (
                    <Button size="sm" variant="ghost" loading={amal === v.id} onClick={() => holatOzgart(v.id, "BEKOR")}>
                      Bekor qilish
                    </Button>
                  )}
                  {boshqaruvchi && (
                    <button type="button" onClick={() => setModal(v)} className="text-2xs text-brand hover:underline ml-auto">
                      Tahrirlash
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {boshqaruvchi && modal && (
        <VazifaModal
          employeeId={employeeId}
          ism={ism}
          vazifa={modal === "yangi" ? null : modal}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
