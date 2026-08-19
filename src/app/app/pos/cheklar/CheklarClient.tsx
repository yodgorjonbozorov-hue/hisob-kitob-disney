"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Money } from "@/components/ui/Money";
import { formatDateUZ, formatSomLabel } from "@/lib/format";
import type { PosChekDTO } from "@/lib/queries/pos";

/** To'lov usulining ko'rinadigan nomi. */
const TOLOV_NOM: Record<string, string> = {
  naqd: "Naqd",
  karta: "Karta",
  click: "Click",
  qarz: "Qarz",
};

/**
 * CHEKLAR TARIXI va QAYTARISH.
 *
 * Qaytarilgan chek ro'yxatdan YO'QOLMAYDI, "qaytarilgan" deb belgilanadi:
 * aks holda kassir uni yana qaytarmoqchi bo'lardi va nima bo'lganini hech
 * kim ko'rmasdi.
 */
export function CheklarClient({
  cheklar,
  qaytaraOladi,
}: {
  cheklar: PosChekDTO[];
  /** Chekni qaytarish faqat direktor/adminda (kassir o'z xatosini yashira olmasin). */
  qaytaraOladi: boolean;
}) {
  const router = useRouter();
  const [ochiq, setOchiq] = useState<string | null>(null);
  const [qaytarish, setQaytarish] = useState<PosChekDTO | null>(null);
  const [sabab, setSabab] = useState("");
  const [xato, setXato] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function qaytar() {
    if (!qaytarish) return;
    setBusy(true);
    setXato(null);
    try {
      const res = await fetch(`/api/pos/chek/${qaytarish.id}/bekor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sabab }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setQaytarish(null);
      setSabab("");
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  if (cheklar.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted text-center py-8">
          Hali chek yo&apos;q — kassada birinchi savdoni qiling.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {cheklar.map((c) => (
          <Card key={c.id} className={c.bekorQilingan ? "opacity-70" : ""}>
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => setOchiq(ochiq === c.id ? null : c.id)}
                className="text-left min-w-0 flex-1"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-fg">{c.raqam}-chek</span>
                  <Badge tone={c.tolovTuri === "qarz" ? "warning" : "neutral"}>
                    {TOLOV_NOM[c.tolovTuri] ?? c.tolovTuri}
                  </Badge>
                  {c.bekorQilingan && <Badge tone="chiqim">qaytarilgan</Badge>}
                </div>
                <p className="text-xs text-muted mt-1">
                  {formatDateUZ(new Date(c.sana))} · {c.kassir} · {c.satrlar.length} ta tovar
                  {c.mijozNomi ? ` · ${c.mijozNomi}` : ""}
                </p>
                {c.bekorQilingan && c.cancelReason && (
                  <p className="text-xs text-expense-fg mt-1">Sabab: {c.cancelReason}</p>
                )}
              </button>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <Money value={c.jamiSumma} size="md" tone={c.bekorQilingan ? "neutral" : "income"} />
                {qaytaraOladi && !c.bekorQilingan && (
                  <Button variant="secondary" size="sm" onClick={() => setQaytarish(c)}>
                    Qaytarish
                  </Button>
                )}
              </div>
            </div>

            {ochiq === c.id && (
              <ul className="mt-3 pt-3 border-t border-line space-y-1">
                {c.satrlar.map((s, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="text-fg truncate">
                      {s.nomi} × {s.miqdor}
                    </span>
                    <span className="text-muted shrink-0 ml-3">{formatSomLabel(s.jamiSumma)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      {qaytarish && (
        <Modal open onClose={() => setQaytarish(null)} title={`${qaytarish.raqam}-chekni qaytarish`}>
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Chek to&apos;liq qaytariladi: tovarlar omborga qaytadi, pul kassadan chiqadi
              {qaytarish.tolovTuri === "qarz" ? " va qarz o'chiriladi" : ""}. Yozuv tarixda
              qoladi — hech narsa butunlay o&apos;chmaydi.
            </p>
            <input
              value={sabab}
              onChange={(e) => setSabab(e.target.value)}
              placeholder="Qaytarish sababi (majburiy)"
              autoFocus
              className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
            />
            {xato && (
              <p className="text-sm text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2">
                {xato}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setQaytarish(null)} disabled={busy}>
                Bekor qilish
              </Button>
              <Button onClick={qaytar} loading={busy} disabled={sabab.trim().length < 3}>
                Qaytarish
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
