"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { KategoriyaDTO } from "@/lib/services/xodimKategoriya";
import { KategoriyaModal } from "./KategoriyaModal";
import { AzolarModal, type XodimTanlovDTO } from "./AzolarModal";
import { formatSomLabel } from "@/lib/format";

/**
 * Kategoriyalar ro'yxati: tartib (↑/↓), aktiv/noaktiv, tahrirlash va a'zolik.
 * O'chirish ATAYLAB yo'q — tarixiy zakaz biriktiruvlari saqlanishi uchun
 * kategoriya faqat noaktiv qilinadi.
 */
export function KategoriyalarClient({
  kategoriyalar,
  xodimlar,
}: {
  kategoriyalar: KategoriyaDTO[];
  xodimlar: XodimTanlovDTO[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<KategoriyaDTO | "yangi" | null>(null);
  const [azolarModal, setAzolarModal] = useState<KategoriyaDTO | null>(null);
  const [amal, setAmal] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setAmal(id);
    setXato(null);
    try {
      const res = await fetch(`/api/hr/kategoriyalar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setXato((await res.json()).error ?? "Xatolik yuz berdi");
        return;
      }
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setAmal(null);
    }
  }

  /** Qo'shni bilan o'rin almashish (tartib qiymatlari indeksga tenglanadi). */
  async function kochir(index: number, delta: -1 | 1) {
    const boshqa = index + delta;
    if (boshqa < 0 || boshqa >= kategoriyalar.length) return;
    await patch(kategoriyalar[index].id, { tartib: boshqa });
    await patch(kategoriyalar[boshqa].id, { tartib: index });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{kategoriyalar.length} ta lavozim</p>
        <Button size="sm" onClick={() => setModal("yangi")}>
          Yangi lavozim
        </Button>
      </div>

      {xato && <p className="text-sm text-expense">{xato}</p>}

      {kategoriyalar.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="Hali lavozim yo'q"
          description="Masalan: Sotuvchi, Animator, Shofyor, Diktor, Videochi, Bezakchi, Dizayner. Har biznes o'z ro'yxatini tuzadi."
          action={<Button onClick={() => setModal("yangi")}>Lavozim yaratish</Button>}
        />
      ) : (
        <div className="space-y-3">
          {kategoriyalar.map((k, i) => (
            <Card key={k.id} className={k.aktiv ? "" : "opacity-60"}>
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    aria-label="Yuqoriga"
                    disabled={i === 0 || amal !== null}
                    onClick={() => kochir(i, -1)}
                    className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-muted disabled:opacity-30 hover:text-fg"
                  >
                    <ArrowUp className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    aria-label="Pastga"
                    disabled={i === kategoriyalar.length - 1 || amal !== null}
                    onClick={() => kochir(i, 1)}
                    className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-muted disabled:opacity-30 hover:text-fg"
                  >
                    <ArrowDown className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-fg">{k.nomi}</p>
                    <Badge tone={k.turi === "sotuvchi" ? "kirim" : "neutral"}>
                      {k.turi === "sotuvchi" ? "Sotuv KPI" : "Ijro KPI"}
                    </Badge>
                    {k.kopXodim && <Badge tone="info">Bir nechta xodim</Badge>}
                    {!k.zakazgaBiriktiriladi && <Badge tone="warning">Zakazga biriktirilmaydi</Badge>}
                    {k.zakazHaqi > 0 && <Badge tone="neutral">{formatSomLabel(k.zakazHaqi)} / zakaz</Badge>}
                    {!k.aktiv && <Badge tone="chiqim">Noaktiv</Badge>}
                  </div>
                  <p className="text-xs text-muted">
                    {k.azolar.length === 0
                      ? "Xodim biriktirilmagan"
                      : k.azolar.map((a) => a.ism).join(", ")}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => setAzolarModal(k)}>
                    A&apos;zolar ({k.azolar.length})
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setModal(k)}>
                    Tahrirlash
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={amal === k.id}
                    onClick={() => patch(k.id, { aktiv: !k.aktiv })}
                  >
                    {k.aktiv ? "O'chirib qo'yish" : "Yoqish"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <KategoriyaModal
          kategoriya={modal === "yangi" ? null : modal}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {azolarModal && (
        <AzolarModal
          kategoriya={azolarModal}
          xodimlar={xodimlar}
          onClose={() => setAzolarModal(null)}
          onDone={() => {
            setAzolarModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
