"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Segmented } from "@/components/ui/Segmented";
import { formatMoney, formatToshkentVaqt } from "@/lib/format";
import type { Kategoriya, Tur } from "./turlar";

/**
 * KATEGORIYA TAFSILOTI VA TAHRIRI — desktopda dialog, mobilda pastki varaq
 * (`Modal` ikkalasini ham beradi).
 *
 * NIMA YO'Q: "O'chirish". Kategoriyaga tranzaksiya, budjet, qarz va CRM
 * bitimlari FK bilan bog'langan, ya'ni o'chirish tarixni buzardi. O'rniga —
 * "Nofaollashtirish": eski yozuvlar joyida qoladi, yangi formalarda esa
 * kategoriya ko'rinmaydi.
 */
export function KategoriyaSheet({
  kategoriya,
  oyNomi,
  kgSavdo,
  onSaqla,
  onClose,
}: {
  kategoriya: Kategoriya;
  oyNomi: string;
  kgSavdo: boolean;
  /** Serverga yuboradi; xato bo'lsa matnini qaytaradi, muvaffaqiyatda `null`. */
  onSaqla: (id: string, ozgarish: Record<string, unknown>, xabar: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const k = kategoriya;
  const [tahrir, setTahrir] = useState(false);
  const [nomi, setNomi] = useState(k.nomi);
  const [turi, setTuri] = useState<Tur>(k.turi === "chiqim" ? "chiqim" : "kirim");
  const [xato, setXato] = useState<string | null>(null);
  const [band, setBand] = useState(false);

  // Turni almashtirish faqat mutlaqo ishlatilmagan kategoriyada. Bu yerdagi
  // shart FAQAT ko'rsatma: haqiqiy qaror backendda (budjet, qarz va CRM
  // bog'lanishlari ham tekshiriladi), shuning uchun uning xatosi ko'rsatiladi.
  const turOzgarishiMumkin = !k.tizim && k.yozuvSoni === 0;

  async function yubor(ozgarish: Record<string, unknown>, xabar: string) {
    if (band) return;
    setBand(true);
    setXato(null);
    const natija = await onSaqla(k.id, ozgarish, xabar);
    setBand(false);
    if (natija) setXato(natija);
  }

  return (
    <Modal open onClose={onClose} title={k.nomi}>
      <div className="space-y-4">
        {k.tizim && (
          <p className="rounded-lg bg-brand-wash text-brand text-2xs px-3 py-2">
            Tizim kategoriyasi: sotuv, qarz, ombor va oylik yozuvlari avtomatik shu
            yerga tushadi. Shuning uchun nomi, turi va holati o&apos;zgartirilmaydi.
          </p>
        )}

        {tahrir ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="kat-nomi" className="block text-2xs text-muted mb-1">Nomi</label>
              <input
                id="kat-nomi"
                type="text"
                value={nomi}
                maxLength={60}
                onChange={(e) => setNomi(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm min-h-[44px]"
              />
            </div>
            <div>
              <p className="text-2xs text-muted mb-1">Turi</p>
              {turOzgarishiMumkin ? (
                <Segmented
                  options={[
                    { value: "kirim" as Tur, label: "Kirim" },
                    { value: "chiqim" as Tur, label: "Chiqim" },
                  ]}
                  value={turi}
                  onChange={setTuri}
                />
              ) : (
                <p className="text-sm text-muted">
                  {k.turi === "kirim" ? "Kirim" : "Chiqim"} —{" "}
                  {k.tizim
                    ? "tizim kategoriyasi, turi o'zgarmaydi."
                    : "bu kategoriya yozuvlarda ishlatilgan, turini o'zgartirib bo'lmaydi."}
                </p>
              )}
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
            <Maydon nom="Turi" qiymat={k.turi === "kirim" ? "Kirim" : "Chiqim"} />
            <Maydon
              nom="Holati"
              qiymat={<Badge tone={k.isActive ? "kirim" : "neutral"}>{k.isActive ? "Faol" : "Nofaol"}</Badge>}
            />
            <Maydon nom="Ishlatilgan" qiymat={`${k.yozuvSoni} ta yozuv`} />
            <Maydon nom={oyNomi} qiymat={k.davrSummasi > 0 ? formatMoney(k.davrSummasi) : "—"} />
            <Maydon nom="Yaratilgan" qiymat={formatToshkentVaqt(new Date(k.createdAt))} />
            {kgSavdo && k.turi === "kirim" && (
              <Maydon nom="Kg savdosi" qiymat={k.kgAsosli ? "Kg bo'yicha" : "Summa bo'yicha"} />
            )}
          </dl>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex flex-wrap gap-2 justify-end pt-1">
          {tahrir ? (
            <>
              <Button variant="secondary" type="button" onClick={() => setTahrir(false)}>
                Bekor qilish
              </Button>
              <Button
                type="button"
                disabled={band}
                onClick={() =>
                  void yubor(
                    { nomi, ...(turOzgarishiMumkin && turi !== k.turi ? { turi } : {}) },
                    "Kategoriya yangilandi"
                  )
                }
              >
                {band ? "Saqlanmoqda..." : "Saqlash"}
              </Button>
            </>
          ) : (
            <>
              {/* Nofaollashtirish — buzg'unchi emas, lekin asosiy amal ham emas:
                  ko'zga tashlanib turmasin deb ikkinchi darajali uslubda. */}
              {!k.tizim && (
                <Button
                  variant="secondary"
                  type="button"
                  disabled={band}
                  onClick={() =>
                    void yubor(
                      { isActive: !k.isActive },
                      k.isActive ? "Kategoriya nofaollashtirildi" : "Kategoriya faollashtirildi"
                    )
                  }
                >
                  {k.isActive ? "Nofaollashtirish" : "Faollashtirish"}
                </Button>
              )}
              {kgSavdo && k.turi === "kirim" && !k.tizim && (
                <Button
                  variant="secondary"
                  type="button"
                  disabled={band}
                  onClick={() => void yubor({ kgAsosli: !k.kgAsosli }, "Kg savdosi holati yangilandi")}
                >
                  {k.kgAsosli ? "Summa bo'yicha qilish" : "Kg bo'yicha qilish"}
                </Button>
              )}
              {!k.tizim && (
                <Button type="button" onClick={() => setTahrir(true)}>
                  Tahrirlash
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Maydon({ nom, qiymat }: { nom: string; qiymat: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs text-faint uppercase tracking-wide">{nom}</dt>
      <dd className="text-sm text-fg mt-0.5 break-words">{qiymat}</dd>
    </div>
  );
}
