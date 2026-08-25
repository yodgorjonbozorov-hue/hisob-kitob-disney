"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { TransactionForm } from "./TransactionForm";
import type { TransactionDTO } from "@/lib/queries/transactions";
import type { QarzMasul } from "./QarzForm";
import type { CategoryOption } from "./turlar";
import type { TezKategoriyalar } from "@/lib/queries/tezKategoriyalar";

/**
 * YANGI YOZUV KIRITISH — sahifadagi asosiy amal.
 *
 * Forma DOIM ochiq turmaydi: u tarixni pastga surib yuborar va sahifaning
 * yarmini band qilardi. O'rniga ikkita aniq tugma turadi va forma varaq
 * (sheet/dialog) bo'lib ochiladi.
 *
 * Desktop — sarlavha yonida `+ Kirim` / `− Chiqim`.
 * Mobil    — pastki o'ng burchakdagi FAB: bosilganda avval tur so'raladi.
 *            FAB pastki navigatsiya USTIDA turadi (`bottom-[5.25rem]` +
 *            safe-area) va markaziy "tez qo'shish" tugmasi bilan
 *            to'qnashmaydi — u ekranning o'rtasida.
 */
export function YangiYozuv({
  categories,
  accounts,
  masullar,
  tezKategoriyalar,
  onCreated,
  onQarzCreated,
  ochSignal = 0,
}: {
  categories: CategoryOption[];
  accounts: { id: string; nomi: string }[];
  masullar: QarzMasul[];
  tezKategoriyalar?: TezKategoriyalar;
  onCreated: (t: TransactionDTO | null, xabar: string) => void;
  onQarzCreated: () => void;
  /**
   * Tashqi "och" signali — hisoblagich. Qiymati o'zgarganda kirim formasi
   * ochiladi. Bo'sh ro'yxatdagi "Birinchi kirimni qo'shish" tugmasi shu
   * orqali ishlaydi: forma holati shu komponentda qoladi, tashqariga
   * chiqarilmaydi.
   */
  ochSignal?: number;
}) {
  /** null — forma yopiq. */
  const [ochiq, setOchiq] = useState<"kirim" | "chiqim" | null>(null);
  const [turTanlov, setTurTanlov] = useState(false);

  useEffect(() => {
    if (ochSignal > 0) setOchiq("kirim");
  }, [ochSignal]);

  function ochish(turi: "kirim" | "chiqim") {
    setTurTanlov(false);
    setOchiq(turi);
  }

  return (
    <>
      {/* Desktop / planshet: aniq birlamchi amallar */}
      <div className="hidden sm:flex items-center gap-2">
        <button
          type="button"
          onClick={() => ochish("kirim")}
          aria-label="Yangi kirim"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-income text-white
            px-4 py-2 min-h-[44px] text-sm font-medium shadow-sm hover:brightness-110 transition"
        >
          <span aria-hidden="true">+</span> Kirim
        </button>
        <button
          type="button"
          onClick={() => ochish("chiqim")}
          aria-label="Yangi chiqim"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-expense text-white
            px-4 py-2 min-h-[44px] text-sm font-medium shadow-sm hover:brightness-110 transition"
        >
          <span aria-hidden="true">−</span> Chiqim
        </button>
      </div>

      {/* Mobil: yopishqoq FAB — 500 ta yozuv pastida ham qo'l ostida.
          YOZUVLI (dumaloq emas): pastki panelning markazidagi umumiy "tez
          qo'shish" tugmasi ham dumaloq va teal — ikkitasi bir xil ko'rinsa
          foydalanuvchi qaysi biri nima qilishini bilmay qoladi. Balandligi
          markaziy tugmadan yuqorida (u panel ustiga ~20px chiqadi). */}
      <button
        type="button"
        onClick={() => setTurTanlov(true)}
        aria-label="Yangi yozuv qo'shish"
        className="sm:hidden fixed right-3 z-40 flex items-center gap-1 rounded-full
          bg-brand text-brand-fg pl-3 pr-4 h-12 shadow-raised active:scale-95 transition
          text-sm font-medium"
        style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} aria-hidden="true" />
        Yangi
      </button>

      {/* Mobil: tur tanlash varag'i */}
      {turTanlov && (
        <Modal open onClose={() => setTurTanlov(false)} title="Yangi yozuv">
          <div className="grid gap-2 pb-2">
            <button
              type="button"
              onClick={() => ochish("kirim")}
              className="w-full rounded-xl bg-income-soft text-income-fg px-4 py-4 min-h-[56px]
                text-base font-medium text-left"
            >
              + Kirim
            </button>
            <button
              type="button"
              onClick={() => ochish("chiqim")}
              className="w-full rounded-xl bg-expense-soft text-expense-fg px-4 py-4 min-h-[56px]
                text-base font-medium text-left"
            >
              − Chiqim
            </button>
          </div>
        </Modal>
      )}

      {ochiq && (
        <Modal
          open
          onClose={() => setOchiq(null)}
          title={ochiq === "kirim" ? "Yangi kirim" : "Yangi chiqim"}
        >
          <TransactionForm
            categories={categories}
            accounts={accounts}
            masullar={masullar}
            tezKategoriyalar={tezKategoriyalar}
            boshTuri={ochiq}
            onCreated={(t, xabar) => {
              setOchiq(null);
              onCreated(t ?? null, xabar);
            }}
            onQarzCreated={() => {
              setOchiq(null);
              onQarzCreated();
            }}
          />
        </Modal>
      )}
    </>
  );
}
