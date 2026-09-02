"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import type { XodimAzoDTO } from "./turlar";

/**
 * XODIM TANLASH VARAG'I (34-talab) — mobil'da pastdan chiqadigan sheet,
 * desktop'da dialog. Qidiruv + 44px qatorlar (barmoq uchun).
 *
 *  - `kop=false` (Animator, Shofyor...): qator bosilganda tanlanadi va
 *    varaq DARHOL yopiladi — ikki bosish shart emas;
 *  - `kop=true` (Videochilar, Bezakchilar): checkbox ro'yxati, "Tayyor"
 *    bilan tasdiqlanadi.
 *
 * Ro'yxatda faqat shu lavozimning FAOL a'zolari (server tayyorlaydi va
 * o'zi ham majburlaydi — 11-talab).
 */
export function XodimTanlovSheet({
  sarlavha,
  azolar,
  tanlangan,
  kop,
  onDone,
  onClose,
}: {
  sarlavha: string;
  azolar: XodimAzoDTO[];
  tanlangan: string[];
  kop: boolean;
  onDone: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [qidiruv, setQidiruv] = useState("");
  const [tanlov, setTanlov] = useState<Set<string>>(() => new Set(tanlangan));

  const korinadigan = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    return q ? azolar.filter((a) => a.ism.toLowerCase().includes(q)) : azolar;
  }, [azolar, qidiruv]);

  function bos(id: string) {
    if (!kop) {
      onDone(tanlov.has(id) ? [] : [id]);
      return;
    }
    setTanlov((old) => {
      const yangi = new Set(old);
      if (yangi.has(id)) yangi.delete(id);
      else yangi.add(id);
      return yangi;
    });
  }

  return (
    <Modal open onClose={onClose} title={sarlavha}>
      <div className="space-y-3">
        {azolar.length > 5 && (
          <input
            value={qidiruv}
            onChange={(e) => setQidiruv(e.target.value)}
            placeholder="Xodimni qidirish..."
            aria-label="Xodimni qidirish"
            className={INPUT_CLASS}
          />
        )}

        {azolar.length === 0 ? (
          <p className="text-sm text-muted py-2">
            Bu lavozimda faol xodim yo&apos;q. Xodimlar → Lavozimlar bo&apos;limida xodim biriktiring.
          </p>
        ) : korinadigan.length === 0 ? (
          <p className="text-sm text-faint py-2">Hech kim topilmadi.</p>
        ) : (
          <ul className="divide-y divide-line max-h-[55vh] overflow-y-auto -mx-1 px-1">
            {korinadigan.map((a) => {
              const bor = tanlov.has(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => bos(a.id)}
                    role={kop ? "checkbox" : "radio"}
                    aria-checked={bor}
                    className="w-full flex items-center gap-3 min-h-[48px] py-2 text-left hover:bg-surface-2 rounded-lg px-1 transition"
                  >
                    <span
                      aria-hidden="true"
                      className={`w-5 h-5 shrink-0 border flex items-center justify-center text-white text-xs ${
                        kop ? "rounded-md" : "rounded-full"
                      } ${bor ? "bg-brand border-brand" : "border-line-strong bg-surface"}`}
                    >
                      {bor ? "✓" : ""}
                    </span>
                    <span className={`text-sm ${bor ? "font-medium text-fg" : "text-fg"}`}>{a.ism}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex gap-2 justify-between pt-1">
          <Button variant="ghost" onClick={() => onDone([])} disabled={tanlangan.length === 0 && tanlov.size === 0}>
            Tozalash
          </Button>
          {kop ? (
            <Button onClick={() => onDone([...tanlov])}>Tayyor ({tanlov.size})</Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Yopish
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
