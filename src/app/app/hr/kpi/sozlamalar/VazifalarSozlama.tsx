"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import type { VazifaDTO, PresetDTO } from "@/lib/kpi/vazifa";
import { VazifaModal } from "./VazifaModal";
import { BiriktirishModal, type BiriktirishXodimi } from "./BiriktirishModal";

export interface XodimQator {
  id: string;
  ism: string;
  lavozim: string | null;
  rasmUrl: string | null;
  /** Shu xodimga biriktirilgan (faol) vazifa id'lari. */
  vazifaIdlari: string[];
}

/** KPI VAZIFALARI — yaratish, tahrirlash, biriktirish va jarima sabablari. */
export function VazifalarSozlama({
  vazifalar,
  presetlar,
  xodimlar,
}: {
  vazifalar: VazifaDTO[];
  presetlar: PresetDTO[];
  xodimlar: XodimQator[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tahrir, setTahrir] = useState<VazifaDTO | null>(null);
  const [yangi, setYangi] = useState(false);
  const [biriktirish, setBiriktirish] = useState<VazifaDTO | null>(null);
  const [ochirilmoqda, setOchirilmoqda] = useState<string | null>(null);

  async function ochir(v: VazifaDTO) {
    if (!confirm(`"${v.nomi}" vazifasi ro'yxatdan olib tashlansinmi? Ball tarixi saqlanadi.`)) return;
    setOchirilmoqda(v.id);
    try {
      const res = await fetch(`/api/hr/kpi/vazifalar/${v.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast({ message: data.error ?? "Xatolik yuz berdi", tone: "error" });
        return;
      }
      toast({ message: "Vazifa olib tashlandi", tone: "success" });
      router.refresh();
    } catch {
      toast({ message: "Tarmoq xatosi — qayta urinib ko'ring", tone: "error" });
    } finally {
      setOchirilmoqda(null);
    }
  }

  function biriktirishRoyxati(v: VazifaDTO): BiriktirishXodimi[] {
    return xodimlar.map((x) => ({
      id: x.id,
      ism: x.ism,
      lavozim: x.lavozim,
      rasmUrl: x.rasmUrl,
      biriktirilgan: x.vazifaIdlari.includes(v.id),
    }));
  }

  const globalPresetlar = presetlar.filter((p) => p.taskId === null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-2xs text-muted max-w-lg">
          Vazifa — har oy takrorlanadigan majburiyat. Har biriga oylik haq belgilanadi va
          bajarilmagan ish uchun ball ayiriladi.
        </p>
        <Button size="sm" onClick={() => setYangi(true)}>
          Vazifa qo&apos;shish
        </Button>
      </div>

      {vazifalar.length === 0 ? (
        <EmptyState
          title="Hali vazifa yaratilmagan"
          description="Vazifa qo'shing va uni xodimlarga biriktiring — shundan keyin ball va vazifa haqi hisoblanadi."
          action={<Button onClick={() => setYangi(true)}>Vazifa qo&apos;shish</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {vazifalar.map((v) => (
            <li key={v.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">
                    {v.nomi}
                    {!v.aktiv && (
                      <span className="ml-2 inline-block align-middle">
                        <Badge tone="neutral">Nofaol</Badge>
                      </span>
                    )}
                  </p>
                  {v.izoh && <p className="text-2xs text-muted mt-0.5">{v.izoh}</p>}
                  <p className="text-2xs text-faint mt-1 tnum">
                    {v.xodimSoni} xodimga biriktirilgan ·{" "}
                    {presetlar.filter((p) => p.taskId === v.id).length} tayyor sabab
                  </p>
                </div>
                <Money value={v.oylikHaq} size="sm" tone="brand" />
              </div>

              <div className="mt-3 flex flex-wrap gap-3 border-t border-line pt-2">
                <button
                  type="button"
                  onClick={() => setBiriktirish(v)}
                  className="text-2xs text-brand hover:underline"
                >
                  Xodimlarga biriktirish
                </button>
                <button
                  type="button"
                  onClick={() => setTahrir(v)}
                  className="text-2xs text-brand hover:underline"
                >
                  Tahrirlash
                </button>
                <button
                  type="button"
                  onClick={() => ochir(v)}
                  disabled={ochirilmoqda === v.id}
                  className="text-2xs text-expense hover:underline disabled:opacity-50"
                >
                  {ochirilmoqda === v.id ? "O'chirilmoqda..." : "Olib tashlash"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {globalPresetlar.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-fg">Umumiy jarima sabablari</h2>
          <p className="text-2xs text-muted mt-1">
            Har qanday vazifaga qo&apos;llanadi. Ishonch buzilishi kunlik limitga kirmaydi.
          </p>
          <ul className="mt-2 space-y-1.5">
            {globalPresetlar.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-fg">
                  {p.sabab}
                  {p.kritik && (
                    <span className="ml-2 inline-block align-middle">
                      <Badge tone="chiqim">Ishonch</Badge>
                    </span>
                  )}
                </span>
                <span className="text-expense font-bold tnum shrink-0">−{p.ball}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(yangi || tahrir) && (
        <VazifaModal
          vazifa={tahrir}
          onClose={() => {
            setYangi(false);
            setTahrir(null);
          }}
          onDone={() => {
            setYangi(false);
            setTahrir(null);
            router.refresh();
          }}
        />
      )}

      {biriktirish && (
        <BiriktirishModal
          vazifa={biriktirish}
          xodimlar={biriktirishRoyxati(biriktirish)}
          onClose={() => setBiriktirish(null)}
          onDone={() => {
            setBiriktirish(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
