"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ASOSIY_USTUNLAR, zakazUstuni, type Ustun } from "@/lib/crm/pipeline";
import { BuyurtmaModal } from "./BuyurtmaModal";
import { BuyurtmaSheet } from "./BuyurtmaSheet";
import { DoskaFiltr } from "./DoskaFiltr";
import { YakunlashTasdiq } from "./YakunlashTasdiq";
import { ZakazUstuni } from "./ZakazUstuni";
import type {
  BuyurtmaDTO,
  KategoriyaDTO,
  SotuvchiDTO,
  XodimDTO,
  XodimKategoriyaDTO,
} from "./turlar";

/**
 * CRM ZAKAZ DOSKASI.
 *
 * Kutilayotgan → Bugungi → Jarayonda → Yutildi (+ arxiv: Yo'qotildi).
 * Ustun BAZADAN o'qilmaydi — u `holat` va `sana` dan hisoblanadi
 * (`lib/crm/pipeline.ts`), server bilan bir xil qoida bo'yicha.
 *
 * Sudrab tashlash (drag & drop) ishlashda davom etadi; mobilda esa ayni
 * o'tishlar tafsilot oynasidagi tugmalarda (10-talab).
 */
export function CrmClient({
  buyurtmalar,
  kategoriyalar,
  xodimlar,
  xodimKategoriyalari,
  sotuvchilar,
  ozimSotuvchi,
  sotuvchiMajburiy,
  sotuvchiOzgartira,
  jamoaHuquqi,
  bahoYozaOladi,
  filtr,
  meId,
  bugun,
}: {
  buyurtmalar: BuyurtmaDTO[];
  kategoriyalar: KategoriyaDTO[];
  xodimlar: XodimDTO[];
  /** Xodim kategoriyalari (Diktor/Dekorator/...) — bajaruvchi biriktiruvi. */
  xodimKategoriyalari: XodimKategoriyaDTO[];
  /** Sotuvchilar — forma selektori va doska filtri uchun. */
  sotuvchilar: SotuvchiDTO[];
  /** Joriy foydalanuvchining sotuvchi profili (avto-tanlash). */
  ozimSotuvchi: string | null;
  sotuvchiMajburiy: boolean;
  sotuvchiOzgartira: boolean;
  /** `crm.jamoa` — mavjud zakaz jamoasini o'zgartirish huquqi. */
  jamoaHuquqi: boolean;
  /** `crm.baho` — sifat nazorati huquqi. */
  bahoYozaOladi: boolean;
  filtr: {
    from: string;
    to: string;
    masulId: string;
    sotuvchiId: string;
    categoryId: string;
    tolov: string;
  };
  meId: string;
  /** Bugungi sana "YYYY-MM-DD" (Asia/Tashkent, server tomondan). */
  bugun: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Bosh sahifadagi "+ Yangi → Buyurtma" shu havola bilan keladi: forma
  // shu yerda qoladi, dashboard uni QAYTA yozmaydi.
  const yangiSoralgan = searchParams.get("yangi") === "1";
  // Xodim samaradorligi sahifasidan "zakazni ochish" havolasi (?buyurtma=ID).
  const buyurtmaId = searchParams.get("buyurtma");
  const [yangiOchiq, setYangiOchiq] = useState(yangiSoralgan);
  const [tanlangan, setTanlangan] = useState<BuyurtmaDTO | null>(
    () => buyurtmalar.find((x) => x.id === buyurtmaId) ?? null
  );
  const [yakunlanadi, setYakunlanadi] = useState<BuyurtmaDTO | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  const ustuni = (b: BuyurtmaDTO): Ustun => zakazUstuni(b.holat, b.sana, bugun);

  /**
   * USTUNGA KO'CHIRISH. "Yutildi" bu yerda darhol bajarilmaydi — pul
   * yozadigan amal hech qachon sudrab tashlash bilan bo'lmasin: tasdiq
   * oynasi ochiladi va u yerda kirim/qarz taqsimoti ko'rsatiladi.
   */
  async function ustungaKochirish(id: string, ustun: Ustun) {
    setXato(null);
    const b = tanlangan?.id === id ? tanlangan : buyurtmalar.find((x) => x.id === id);
    if (!b) return;
    if (ustuni(b) === ustun) return;

    if (ustun === "YUTILDI") {
      setTanlangan(null);
      setYakunlanadi(b);
      return;
    }

    // "Bugungi" — holat emas, SANA: zakaz sanasi bugunga suriladi.
    const tana =
      ustun === "BUGUNGI"
        ? { bugungaKochir: true }
        : { holat: ustun === "JARAYONDA" ? "JARAYONDA" : "KUTILMOQDA" };

    const res = await fetch(`/api/crm/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tana),
    });
    if (!res.ok) {
      setXato((await res.json()).error ?? "Xatolik yuz berdi");
      return;
    }
    setTanlangan(null);
    router.refresh();
  }

  /** Yo'qotildi — arxivga (asosiy ustunlardan tashqarida). */
  async function yoqotildi(id: string) {
    setXato(null);
    const res = await fetch(`/api/crm/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holat: "YOQOTILDI" }),
    });
    if (!res.ok) {
      setXato((await res.json()).error ?? "Xatolik yuz berdi");
      return;
    }
    setTanlangan(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => setYangiOchiq(true)}
          className="bg-income text-white font-medium rounded-lg px-4 py-2 text-sm hover:brightness-110 transition"
        >
          + Yangi zakaz
        </button>
        {xato && <p className="text-expense text-sm">{xato}</p>}
      </div>

      <DoskaFiltr
        filtr={filtr}
        kategoriyalar={kategoriyalar}
        xodimlar={xodimlar}
        sotuvchilar={sotuvchilar}
        bugun={bugun}
      />

      {/* Kanban — mobilda gorizontal svayp bilan yuriladi (16-talab). */}
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory">
        {ASOSIY_USTUNLAR.map((u) => (
          <div key={u} className="snap-start">
            <ZakazUstuni
              ustun={u}
              bugun={bugun}
              zakazlar={buyurtmalar.filter((b) => ustuni(b) === u)}
              onDrop={() => dragId && ustungaKochirish(dragId, u)}
              onTanlash={setTanlangan}
              onDragStart={setDragId}
              onDragEnd={() => setDragId(null)}
            />
          </div>
        ))}
      </div>

      {yangiOchiq && (
        <BuyurtmaModal
          kategoriyalar={kategoriyalar}
          xodimlar={xodimlar}
          xodimKategoriyalari={xodimKategoriyalari}
          sotuvchilar={sotuvchilar}
          ozimSotuvchi={ozimSotuvchi}
          sotuvchiMajburiy={sotuvchiMajburiy}
          sotuvchiOzgartira={sotuvchiOzgartira}
          meId={meId}
          bugun={bugun}
          onClose={() => setYangiOchiq(false)}
        />
      )}
      {tanlangan && (
        <BuyurtmaSheet
          b={tanlangan}
          ustun={ustuni(tanlangan)}
          bugun={bugun}
          kategoriyalar={kategoriyalar}
          xodimKategoriyalari={xodimKategoriyalari}
          sotuvchilar={sotuvchilar}
          sotuvchiOzgartira={sotuvchiOzgartira}
          jamoaHuquqi={jamoaHuquqi}
          bahoYozaOladi={bahoYozaOladi}
          meId={meId}
          onUstunga={(u) => ustungaKochirish(tanlangan.id, u)}
          onYoqotildi={() => yoqotildi(tanlangan.id)}
          onTahrirlandi={(yangi) => {
            // Ochiq oyna serverdan kelgan snapshot ustida ishlaydi — yangi
            // qiymatlar darhol ko'rinsin (doskaning o'zini `router.refresh()`
            // yangilaydi).
            setTanlangan({ ...tanlangan, ...yangi });
            router.refresh();
          }}
          onClose={() => setTanlangan(null)}
        />
      )}
      {yakunlanadi && (
        <YakunlashTasdiq
          b={yakunlanadi}
          onClose={() => setYakunlanadi(null)}
          onDone={() => {
            setYakunlanadi(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
