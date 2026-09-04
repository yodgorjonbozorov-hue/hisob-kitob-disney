"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { useToast } from "@/components/ui/Toast";
import { ChiqimModal, type ChiqimTanlov } from "./ChiqimModal";
import type { ChiqimPaneliDTO } from "@/lib/crm/yuqoriPanel";

/**
 * CHIQIM — buyurtmalar sahifasining 2-bloki.
 *
 * Maqsad: xodim zakazlar bilan ishlayotganda boshqa sahifaga o'tmasdan
 * xarajat yozsin. Bu yerda faqat ENG MUHIM raqam (bugungi chiqim) va oxirgi
 * uchta yozuv — to'liq ro'yxat Kirim/Chiqim sahifasida qoladi.
 *
 * Ko'rinadigan chiqimlar mavjud KO'RINUVCHANLIK qoidasiga bo'ysunadi
 * (lib/auth/visibility.ts): direktor biznesnikini, xodim o'zinikini ko'radi.
 */
export function ChiqimKartasi({
  chiqim,
  kategoriyalar,
  kassalar,
  bugun,
  onYangilandi,
}: {
  chiqim: ChiqimPaneliDTO;
  kategoriyalar: ChiqimTanlov[];
  kassalar: ChiqimTanlov[];
  bugun: string;
  onYangilandi: () => void;
}) {
  const { toast } = useToast();
  const [modal, setModal] = useState(false);

  return (
    <section className="bg-surface rounded-2xl border border-line p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-fg">Chiqim</h2>
        <p className="text-sm text-muted">Bugungi chiqim</p>
        <Money value={chiqim.bugun} size="xl" tone={chiqim.bugun > 0 ? "expense" : "neutral"} />
      </div>

      <div>
        <p className="text-2xs uppercase text-muted mb-1.5">Oxirgi chiqimlar</p>
        {chiqim.oxirgilar.length === 0 ? (
          <p className="text-sm text-faint">Hali chiqim yo&apos;q.</p>
        ) : (
          <ul className="space-y-1.5">
            {chiqim.oxirgilar.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between gap-2 text-sm border-b border-line/60 pb-1.5 last:border-0"
              >
                <span className="text-fg truncate">{q.nomi}</span>
                <span className="tnum text-expense shrink-0">
                  {q.summa.toLocaleString("ru-RU")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto pt-1">
        <Button onClick={() => setModal(true)}>+ Chiqim qilish</Button>
      </div>

      {modal && (
        <ChiqimModal
          kategoriyalar={kategoriyalar}
          kassalar={kassalar}
          bugun={bugun}
          onClose={() => setModal(false)}
          onSaqlandi={(xabar) => {
            setModal(false);
            toast({ message: xabar, tone: "success" });
            onYangilandi();
          }}
        />
      )}
    </section>
  );
}
