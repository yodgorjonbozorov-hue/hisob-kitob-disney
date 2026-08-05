"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateUZ } from "@/lib/format";
import { SHARTNOMA_HOLAT_NOMI, type ShartnomaHolat } from "@/lib/validation/hujjat";
import type { ShartnomaDTO, HujjatStats } from "@/lib/queries/hujjat";
import { ShartnomaModal } from "./ShartnomaModal";
import { IlovaModal } from "./IlovaModal";

const HOLAT_TONE: Record<string, "kirim" | "chiqim" | "neutral"> = {
  faol: "kirim",
  tugagan: "neutral",
  bekor: "chiqim",
};

/** Muddat matni: o'tgan bo'lsa qancha o'tgani, aks holda qancha qolgani. */
function muddatMatni(kunQoldi: number | null): string | null {
  if (kunQoldi === null) return null;
  if (kunQoldi < 0) return `${Math.abs(kunQoldi)} kun oldin tugagan`;
  if (kunQoldi === 0) return "bugun tugaydi";
  return `${kunQoldi} kun qoldi`;
}

export function HujjatlarClient({
  shartnomalar,
  stats,
  mijozlar,
  taminotchilar,
  boshqaruvchi,
  yuklashMumkin,
}: {
  shartnomalar: ShartnomaDTO[];
  stats: HujjatStats;
  mijozlar: { id: string; ism: string }[];
  taminotchilar: { id: string; nomi: string }[];
  boshqaruvchi: boolean;
  yuklashMumkin: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ShartnomaDTO | "yangi" | null>(null);
  const [ilova, setIlova] = useState<ShartnomaDTO | null>(null);
  const [ochiq, setOchiq] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  async function ilovaniOchir(id: string) {
    setXato(null);
    try {
      const res = await fetch(`/api/hujjatlar/ilova/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setXato(data.error ?? "O'chirib bo'lmadi");
        return;
      }
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-muted text-sm mb-1">Faol shartnoma</p>
          <p className="text-2xl font-bold text-fg tnum">{stats.faolShartnoma}</p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Muddati yaqin / o&apos;tgan</p>
          <p className={`text-2xl font-bold tnum ${stats.ogohlantirish > 0 ? "text-expense" : "text-fg"}`}>
            {stats.ogohlantirish}
          </p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Biriktirilgan hujjat</p>
          <p className="text-2xl font-bold text-fg tnum">{stats.jamiIlova}</p>
        </Card>
      </div>

      <div className="flex justify-end">
        {boshqaruvchi && <Button onClick={() => setModal("yangi")}>Yangi shartnoma</Button>}
      </div>

      {!yuklashMumkin && (
        <p className="text-2xs text-faint text-right">
          Fayl saqlagich sozlanmagan — hujjatlar tashqi havola sifatida biriktiriladi.
        </p>
      )}

      {xato && <p className="text-sm text-expense">{xato}</p>}

      <Card>
        {shartnomalar.length === 0 ? (
          <EmptyState
            icon="📄"
            title="Hali shartnoma yo'q"
            description="Shartnoma muddati bazada bo'lsa, tugashiga oz qolganda bildirishnomalar ro'yxatida ogohlantirish chiqadi."
            action={boshqaruvchi ? <Button onClick={() => setModal("yangi")}>Birinchi shartnoma</Button> : undefined}
          />
        ) : (
          <div className="space-y-2">
            {shartnomalar.map((s) => {
              const yoyilgan = ochiq === s.id;
              const muddat = muddatMatni(s.kunQoldi);
              return (
                <div key={s.id} className="border border-line rounded-xl">
                  <button
                    type="button"
                    onClick={() => setOchiq(yoyilgan ? null : s.id)}
                    className="w-full text-left p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-fg truncate">
                        {s.raqam} · {s.nomi}
                      </p>
                      <p className="text-2xs text-faint">
                        {s.kontragentNomi ?? "kontragent ko'rsatilmagan"} ·{" "}
                        {formatDateUZ(new Date(s.boshlanish))}
                        {s.tugash && ` — ${formatDateUZ(new Date(s.tugash))}`}
                        {s.ilovalar.length > 0 && ` · ${s.ilovalar.length} ta hujjat`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {muddat && (
                        <span className={`text-2xs ${s.ogohlantirish ? "text-expense" : "text-faint"}`}>
                          {muddat}
                        </span>
                      )}
                      <Money value={s.summa} size="md" tone="neutral" />
                      <Badge tone={HOLAT_TONE[s.holat] ?? "neutral"}>
                        {SHARTNOMA_HOLAT_NOMI[s.holat as ShartnomaHolat] ?? s.holat}
                      </Badge>
                    </div>
                  </button>

                  {yoyilgan && (
                    <div className="border-t border-line p-3 space-y-3">
                      {s.izoh && <p className="text-2xs text-muted">{s.izoh}</p>}

                      {s.ilovalar.length === 0 ? (
                        <p className="text-2xs text-faint">Hujjat biriktirilmagan.</p>
                      ) : (
                        <ul className="space-y-1">
                          {s.ilovalar.map((i) => (
                            <li key={i.id} className="flex items-center justify-between gap-2 text-2xs">
                              <a
                                href={i.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand hover:underline truncate"
                              >
                                {i.nomi}
                                {i.saqlagich === "havola" ? " ↗" : ""}
                              </a>
                              {boshqaruvchi && (
                                <button
                                  type="button"
                                  onClick={() => ilovaniOchir(i.id)}
                                  className="text-faint hover:text-expense shrink-0"
                                >
                                  o&apos;chirish
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setIlova(s)}>
                          Hujjat biriktirish
                        </Button>
                        {boshqaruvchi && (
                          <Button size="sm" variant="ghost" onClick={() => setModal(s)}>
                            Tahrirlash
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {modal && (
        <ShartnomaModal
          shartnoma={modal === "yangi" ? null : modal}
          mijozlar={mijozlar}
          taminotchilar={taminotchilar}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {ilova && (
        <IlovaModal
          entity="contract"
          entityId={ilova.id}
          sarlavha={ilova.raqam}
          yuklashMumkin={yuklashMumkin}
          onClose={() => setIlova(null)}
          onDone={() => {
            setIlova(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
