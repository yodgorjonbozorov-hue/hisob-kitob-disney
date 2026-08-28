"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { HAFTA_KUNLARI } from "@/lib/validation/davomat";
import type { JadvalDTO, JadvalKunDTO } from "./JadvalClient";

const KUN_TARTIBI = [1, 2, 3, 4, 5, 6, 0];

function boshlangichKunlar(jadval: JadvalDTO | null): JadvalKunDTO[] {
  if (jadval) return jadval.kunlar;
  // Standart taklif: Du-Ju 09:00-18:00, Shanba 09:00-14:00, Yakshanba dam.
  return [0, 1, 2, 3, 4, 5, 6].map((hafta) => ({
    hafta,
    ishKuni: hafta !== 0,
    boshlanish: hafta === 0 ? null : "09:00",
    tugash: hafta === 0 ? null : hafta === 6 ? "14:00" : "18:00",
  }));
}

export function JadvalModal({
  jadval,
  onYopish,
}: {
  jadval: JadvalDTO | null;
  onYopish: () => void;
}) {
  const router = useRouter();
  const [nomi, setNomi] = useState(jadval?.nomi ?? "");
  const [imtiyoz, setImtiyoz] = useState(jadval?.imtiyozDaqiqa ?? 5);
  const [standart, setStandart] = useState(jadval?.standart ?? false);
  const [kunlar, setKunlar] = useState<JadvalKunDTO[]>(boshlangichKunlar(jadval));
  const [xato, setXato] = useState<string | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  function kunniOzgart(hafta: number, patch: Partial<JadvalKunDTO>) {
    setKunlar((old) => old.map((k) => (k.hafta === hafta ? { ...k, ...patch } : k)));
  }

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato(null);
    setYuklanmoqda(true);
    try {
      const body = {
        nomi,
        imtiyozDaqiqa: imtiyoz,
        standart,
        kunlar: kunlar.map((k) => ({
          hafta: k.hafta,
          ishKuni: k.ishKuni,
          boshlanish: k.ishKuni ? k.boshlanish : null,
          tugash: k.ishKuni ? k.tugash : null,
        })),
      };
      const res = await fetch(jadval ? `/api/hr/jadval/${jadval.id}` : "/api/hr/jadval", {
        method: jadval ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onYopish();
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setYuklanmoqda(false);
    }
  }

  return (
    <Modal open onClose={onYopish} title={jadval ? "Jadvalni tahrirlash" : "Yangi ish jadvali"} size="lg">
      <form onSubmit={saqla} className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="j-nomi">Jadval nomi</label>
          <input
            id="j-nomi"
            className={INPUT_CLASS}
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            placeholder="Masalan: Ofis xodimlari"
            required
            maxLength={120}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className={LABEL_CLASS} htmlFor="j-imtiyoz">Imtiyoz (daqiqa)</label>
            <input
              id="j-imtiyoz"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              className={INPUT_CLASS}
              value={imtiyoz}
              onChange={(e) => setImtiyoz(parseInt(e.target.value || "0", 10))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg min-h-[44px]">
            <input
              type="checkbox"
              checked={standart}
              onChange={(e) => setStandart(e.target.checked)}
              className="w-4 h-4"
            />
            Biznes standart jadvali
          </label>
        </div>
        <p className="text-2xs text-muted">
          Imtiyoz: boshlanish 09:00, imtiyoz 5 bo&apos;lsa — 09:05 gacha &quot;vaqtida&quot;,
          09:06 dan &quot;kechikdi&quot;.
        </p>

        <div className="space-y-2">
          {KUN_TARTIBI.map((h) => {
            const kun = kunlar.find((k) => k.hafta === h)!;
            return (
              <div key={h} className="flex items-center gap-2">
                <label className="flex items-center gap-2 w-28 shrink-0 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={kun.ishKuni}
                    onChange={(e) =>
                      kunniOzgart(h, {
                        ishKuni: e.target.checked,
                        boshlanish: e.target.checked ? kun.boshlanish ?? "09:00" : null,
                        tugash: e.target.checked ? kun.tugash ?? "18:00" : null,
                      })
                    }
                    className="w-4 h-4"
                  />
                  {HAFTA_KUNLARI[h]}
                </label>
                {kun.ishKuni ? (
                  <>
                    <input
                      type="time"
                      className={`${INPUT_CLASS} flex-1`}
                      value={kun.boshlanish ?? ""}
                      onChange={(e) => kunniOzgart(h, { boshlanish: e.target.value })}
                      required
                    />
                    <span className="text-muted">→</span>
                    <input
                      type="time"
                      className={`${INPUT_CLASS} flex-1`}
                      value={kun.tugash ?? ""}
                      onChange={(e) => kunniOzgart(h, { tugash: e.target.value })}
                      required
                    />
                  </>
                ) : (
                  <span className="text-sm text-faint">Dam olish</span>
                )}
              </div>
            );
          })}
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}
        <Button type="submit" className="w-full" loading={yuklanmoqda}>
          Saqlash
        </Button>
      </form>
    </Modal>
  );
}
