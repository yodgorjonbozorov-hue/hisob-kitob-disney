"use client";

import { ChevronDown } from "lucide-react";
import { formatMoney, formatSom } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { KategoriyaSkelet } from "@/components/kategoriya/KategoriyaYozuvlar";
import { TransactionCards } from "./TransactionCards";
import type {
  KategoriyaJami,
  TransactionDTO,
} from "@/lib/queries/transactions";
import type { YozuvAmallari } from "./YozuvOynalari";
import type { KategoriyaHolati } from "./KategoriyaKorinish";

/**
 * Bitta BO'LIM — "Kirim" yoki "Chiqim" va uning kategoriyalari.
 *
 * Kirim va chiqim ATAYLAB ikki alohida bo'lim: bitta ro'yxatda aralashsa,
 * "+" va "−" belgilariga qaramay ko'z ularni bir qatorga qo'shib o'qiydi
 * va bo'lim yig'indisi ma'nosini yo'qotadi.
 */
export function KategoriyaBolimi({
  sarlavha,
  kirim,
  royxat,
  ochiq,
  holat,
  onAlmashtir,
  onYana,
  amallar,
  ozgartirsaBoladi,
}: {
  sarlavha: string;
  kirim: boolean;
  royxat: KategoriyaJami[];
  ochiq: string | null;
  holat: Record<string, KategoriyaHolati>;
  onAlmashtir: (id: string) => void;
  onYana: (id: string, page: number) => void;
  amallar: YozuvAmallari;
  ozgartirsaBoladi: (t: TransactionDTO) => boolean;
}) {
  const jami = royxat.reduce((a, k) => a + k.summa, 0);

  return (
    <section className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
      <header className="flex items-baseline justify-between gap-2 px-4 py-2.5 bg-surface-2 border-b border-line">
        <h2
          className={`text-sm font-semibold ${kirim ? "text-income" : "text-expense"}`}
        >
          {sarlavha}
        </h2>
        <span className="text-2xs text-muted tnum">
          {royxat.length} ta kategoriya ·{" "}
          <span
            className={`font-medium ${kirim ? "text-income" : "text-expense"}`}
          >
            {kirim ? "+" : "−"} {formatSom(jami)}
          </span>
        </span>
      </header>

      <ul className="divide-y divide-line">
        {royxat.map((k) => {
          const h = holat[k.categoryId];
          const ochilgan = ochiq === k.categoryId;
          return (
            <li key={k.categoryId}>
              <button
                type="button"
                onClick={() => onAlmashtir(k.categoryId)}
                aria-expanded={ochilgan}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left
                  hover:bg-surface-2 active:bg-surface-2 transition"
              >
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-faint transition-transform ${ochilgan ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-fg truncate">
                    {k.nomi}
                  </span>
                  <span className="block text-2xs text-muted tnum">
                    {k.soni} ta yozuv
                  </span>
                </span>
                <span
                  className={`font-display tnum font-semibold whitespace-nowrap ${
                    kirim ? "text-income" : "text-expense"
                  }`}
                  title={formatMoney(k.summa)}
                >
                  {kirim ? "+" : "−"} {formatSom(k.summa)}
                </span>
              </button>

              {ochilgan && (
                <div className="border-t border-line bg-app/40">
                  {h?.xato && (
                    <p role="alert" className="text-sm text-expense px-4 py-3">
                      {h.xato}
                    </p>
                  )}
                  {h?.yuklanmoqda && h.items.length === 0 && (
                    <div className="p-4">
                      <KategoriyaSkelet />
                    </div>
                  )}
                  {h && h.items.length > 0 && (
                    <>
                      <TransactionCards
                        items={h.items}
                        onBatafsil={amallar.onBatafsil}
                        onTahrirlash={amallar.onTahrirlash}
                        onOchirish={amallar.onOchirish}
                        ozgartirsaBoladi={ozgartirsaBoladi}
                        kategoriyaniYashir
                      />
                      {h.items.length < h.total && (
                        <div className="px-4 py-3 border-t border-line">
                          <Button
                            variant="secondary"
                            className="w-full"
                            loading={h.yuklanmoqda}
                            onClick={() => onYana(k.categoryId, h.page + 1)}
                          >
                            Yana {h.total - h.items.length} ta yozuv
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                  {h && !h.yuklanmoqda && !h.xato && h.items.length === 0 && (
                    <p className="text-sm text-muted px-4 py-4">
                      Bu davrda yozuv yo&apos;q.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
