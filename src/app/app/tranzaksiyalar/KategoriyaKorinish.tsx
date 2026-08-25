"use client";

import { useCallback, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { KategoriyaBolimi } from "./KategoriyaBolimi";
import type {
  KategoriyaJami,
  TransactionDTO,
} from "@/lib/queries/transactions";
import type { YozuvAmallari } from "./YozuvOynalari";

/** Bir marta yuklanadigan yozuvlar soni (listTransactions chegarasi 100). */
const BOLAK = 100;

export interface KategoriyaHolati {
  items: TransactionDTO[];
  total: number;
  page: number;
  yuklanmoqda: boolean;
  xato: string | null;
}

/**
 * KATEGORIYA KESIMI — sahifaning ASOSIY ro'yxati.
 *
 * Ierarxiya: Kirim/Chiqim → KATEGORIYA → o'sha kategoriyaning yozuvlari →
 * yozuvlar ichida sana bo'yicha guruh (Bugun / Kecha / eskiroq).
 *
 * Nega sana emas, kategoriya birinchi: "kecha nima bo'ldi" degan savolga
 * kunlik hisobot javob beradi. Bu sahifada esa odam "Gulga qancha ketdi",
 * "Deji qancha keltirdi" deb qaraydi — ya'ni PUL QAYERGA ketgani. Sana
 * bo'yicha tekis lenta bu savolga javob berish uchun har safar ko'z bilan
 * jamlashni talab qilardi.
 *
 * Kategoriya JAMLARI serverda, joriy filtr bo'yicha hisoblanadi
 * (`listKategoriyaJamlari`). Ochilgandagi yozuvlar ham AYNI filtr bilan
 * `/api/transactions` dan keladi — kartadagi summa va ichkaridagi
 * yozuvlar bir xil to'plamdan.
 */
export function KategoriyaKorinish({
  kategoriyalar,
  filtrQuery,
  amallar,
  ozgartirsaBoladi,
  filtrFaol,
  onFiltrTozalash,
  onYangi,
  yangilanish,
}: {
  kategoriyalar: KategoriyaJami[];
  /** Joriy URL filtrlari (`searchParams.toString()`) — `page` dan tashqari. */
  filtrQuery: string;
  amallar: YozuvAmallari;
  ozgartirsaBoladi: (t: TransactionDTO) => boolean;
  filtrFaol: boolean;
  onFiltrTozalash: () => void;
  onYangi: () => void;
  /**
   * Yozuv qo'shilgan/o'chirilganda o'sgan hisoblagich — ochiq kategoriya
   * keshini bekor qiladi, aks holda ro'yxat eskirgan holda qolardi.
   */
  yangilanish: number;
}) {
  const [ochiq, setOchiq] = useState<string | null>(null);
  const [holat, setHolat] = useState<Record<string, KategoriyaHolati>>({});
  const [keshBelgisi, setKeshBelgisi] = useState(yangilanish);

  // Tashqarida yozuv o'zgardi — yuklangan bo'laklar eskirdi.
  if (keshBelgisi !== yangilanish) {
    setKeshBelgisi(yangilanish);
    setHolat({});
  }

  const yukla = useCallback(
    async (categoryId: string, page: number) => {
      setHolat((p) => ({
        ...p,
        [categoryId]: {
          items: page === 1 ? [] : (p[categoryId]?.items ?? []),
          total: p[categoryId]?.total ?? 0,
          page,
          yuklanmoqda: true,
          xato: null,
        },
      }));
      try {
        const params = new URLSearchParams(filtrQuery);
        params.delete("page");
        // Tanlangan kategoriya USTUN turadi: filtrda boshqasi bo'lsa ham
        // foydalanuvchi aynan shu qatorni ochdi.
        params.set("categoryId", categoryId);
        params.set("page", String(page));
        params.set("pageSize", String(BOLAK));
        const res = await fetch(`/api/transactions?${params.toString()}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setHolat((p) => ({
          ...p,
          [categoryId]: {
            items:
              page === 1
                ? data.items
                : [...(p[categoryId]?.items ?? []), ...data.items],
            total: data.total,
            page,
            yuklanmoqda: false,
            xato: null,
          },
        }));
      } catch {
        setHolat((p) => ({
          ...p,
          [categoryId]: {
            items: p[categoryId]?.items ?? [],
            total: p[categoryId]?.total ?? 0,
            page,
            yuklanmoqda: false,
            xato: "Yozuvlarni yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.",
          },
        }));
      }
    },
    [filtrQuery],
  );

  function almashtir(categoryId: string) {
    if (ochiq === categoryId) {
      setOchiq(null);
      return;
    }
    setOchiq(categoryId);
    if (!holat[categoryId] || holat[categoryId].xato) yukla(categoryId, 1);
  }

  if (kategoriyalar.length === 0) {
    return (
      <div className="bg-surface rounded-2xl shadow-sm border border-line">
        {filtrFaol ? (
          <EmptyState
            title="Filtrga mos yozuv topilmadi"
            description="Sana oralig'ini kengaytiring yoki filtrlarni tozalab ko'ring."
            icon="🔍"
            action={
              <Button variant="secondary" onClick={onFiltrTozalash}>
                Filtrlarni tozalash
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Hozircha yozuv yo'q"
            description="Birinchi kirim yoki chiqimni qo'shing — kategoriyalar shu zahoti paydo bo'ladi."
            icon="🧾"
            action={
              <Button onClick={onYangi}>
                + Birinchi kirimni qo&apos;shish
              </Button>
            }
          />
        )}
      </div>
    );
  }

  const kirimlar = kategoriyalar.filter((k) => k.turi !== "chiqim");
  const chiqimlar = kategoriyalar.filter((k) => k.turi === "chiqim");

  return (
    <div className="space-y-4">
      {kirimlar.length > 0 && (
        <KategoriyaBolimi
          sarlavha="Kirim"
          kirim
          royxat={kirimlar}
          ochiq={ochiq}
          holat={holat}
          onAlmashtir={almashtir}
          onYana={yukla}
          amallar={amallar}
          ozgartirsaBoladi={ozgartirsaBoladi}
        />
      )}
      {chiqimlar.length > 0 && (
        <KategoriyaBolimi
          sarlavha="Chiqim"
          kirim={false}
          royxat={chiqimlar}
          ochiq={ochiq}
          holat={holat}
          onAlmashtir={almashtir}
          onYana={yukla}
          amallar={amallar}
          ozgartirsaBoladi={ozgartirsaBoladi}
        />
      )}
    </div>
  );
}
