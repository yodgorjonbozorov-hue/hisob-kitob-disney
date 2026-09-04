"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ASOSIY_USTUNLAR,
  kirimUlushi,
  qarzUlushi,
  zakazUstuni,
  type Ustun,
} from "@/lib/crm/pipeline";
import { BuyurtmaModal } from "./BuyurtmaModal";
import { BuyurtmaSheet } from "./BuyurtmaSheet";
import { DoskaFiltr } from "./DoskaFiltr";
import { YakunlashTasdiq } from "./YakunlashTasdiq";
import { ZakazUstuni } from "./ZakazUstuni";
import { useUstunSahifalari } from "./useUstunSahifalari";
import { useOptimistikKochish } from "./useOptimistikKochish";
import type {
  BuyurtmaDTO,
  KategoriyaDTO,
  SotuvchiDTO,
  UstunSahifaDTO,
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
 *
 * Ikki mantiq alohida hooklarda: ustun sahifalari ("Yana ko'rsatish" —
 * `useUstunSahifalari`) va optimistik ko'chish (`useOptimistikKochish`).
 */
export function CrmClient({
  sahifalar,
  kategoriyalar,
  xodimlar,
  xodimKategoriyalari,
  sotuvchilar,
  sotuvchiMajburiy,
  jamoaHuquqi,
  bahoYozaOladi,
  filtr,
  meId,
  bugun,
}: {
  /** Har ustunning BIRINCHI sahifasi (server tomonda kesilgan, 10 tadan). */
  sahifalar: UstunSahifaDTO[];
  kategoriyalar: KategoriyaDTO[];
  xodimlar: XodimDTO[];
  /** Xodim kategoriyalari (Diktor/Dekorator/...) — bajaruvchi biriktiruvi. */
  xodimKategoriyalari: XodimKategoriyaDTO[];
  /** Sotuvchilar — forma selektori va doska filtri uchun. */
  sotuvchilar: SotuvchiDTO[];
  sotuvchiMajburiy: boolean;
  /** `crm.jamoa` va `crm.baho` huquqlari. */
  jamoaHuquqi: boolean;
  bahoYozaOladi: boolean;
  /** Joriy filtr — "Yana ko'rsatish" so'roviga ham AYNI shu uzatiladi. */
  filtr: Record<"from" | "to" | "masulId" | "sotuvchiId" | "categoryId" | "tolov", string>;
  meId: string;
  /** Bugungi sana "YYYY-MM-DD" (Asia/Tashkent, server tomondan). */
  bugun: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // "+ Yangi → Buyurtma" (bosh sahifa) va "zakazni ochish" (xodim
  // samaradorligi) havolalari — forma/oyna shu yerda ochiladi.
  const yangiSoralgan = searchParams.get("yangi") === "1";
  const buyurtmaId = searchParams.get("buyurtma");
  // USTUN SAHIFALARI VA "Yana ko'rsatish" — alohida hookda.
  const { holat: ustunHolati, zakazlar: yuklangan, yuklanayotgan, yanaKorsatish, sahifaXatosi } =
    useUstunSahifalari(sahifalar, filtr);
  // OPTIMISTIK KO'CHISH (server javobigacha) — alohida hookda.
  const { zakazlar, mahalliyYoz } = useOptimistikKochish(yuklangan);

  const [yangiOchiq, setYangiOchiq] = useState(yangiSoralgan);
  // Xodim samaradorligi sahifasidan kelgan havola (?buyurtma=ID) — zakaz
  // yuklangan sahifada bo'lsa oyna darhol ochiladi.
  const [tanlangan, setTanlangan] = useState<BuyurtmaDTO | null>(
    () => zakazlar.find((x) => x.id === buyurtmaId) ?? null
  );
  const [yakunlanadi, setYakunlanadi] = useState<BuyurtmaDTO | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const ustuni = (b: BuyurtmaDTO): Ustun => zakazUstuni(b.holat, b.sana, bugun);

  /**
   * USTUNGA KO'CHIRISH. "Yutildi" darhol bajarilmaydi — pul yozadigan amal
   * sudrab tashlash bilan bo'lmasin: tasdiq oynasi kirim/qarzni ko'rsatadi.
   */
  async function ustungaKochirish(id: string, ustun: Ustun) {
    setXato(null);
    const b = zakazlar.find((x) => x.id === id) ?? (tanlangan?.id === id ? tanlangan : undefined);
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
    // "Bugungi" — HOLAT emas, sana o'zgarishi (pipeline qoidasi).
    if (ustun === "BUGUNGI") mahalliyYoz(b, b.holat, bugun);
    else mahalliyYoz(b, ustun === "JARAYONDA" ? "JARAYONDA" : "KUTILMOQDA");
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
    const b = zakazlar.find((x) => x.id === id);
    if (b) mahalliyYoz(b, "YOQOTILDI");
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
        {(xato ?? sahifaXatosi) && (
          <p className="text-expense text-sm">{xato ?? sahifaXatosi}</p>
        )}
      </div>

      <DoskaFiltr
        filtr={filtr}
        kategoriyalar={kategoriyalar}
        xodimlar={xodimlar}
        sotuvchilar={sotuvchilar}
        bugun={bugun}
      />

      {/* Kanban — mobilda gorizontal svayp (16-talab), har ustun 10 tadan. */}
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory">
        {ASOSIY_USTUNLAR.map((u) => (
          <div key={u} className="snap-start">
            <ZakazUstuni
              ustun={u}
              bugun={bugun}
              zakazlar={zakazlar.filter((b) => ustuni(b) === u)}
              soni={ustunHolati[u]?.jami ?? 0}
              summa={ustunHolati[u]?.summa ?? 0}
              yanaBormi={Boolean(ustunHolati[u]?.kursor)}
              yuklanmoqda={yuklanayotgan === u}
              onYana={() => yanaKorsatish(u)}
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
          sotuvchiMajburiy={sotuvchiMajburiy}
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
          jamoaHuquqi={jamoaHuquqi}
          bahoYozaOladi={bahoYozaOladi}
          meId={meId}
          onUstunga={(u) => ustungaKochirish(tanlangan.id, u)}
          onYoqotildi={() => yoqotildi(tanlangan.id)}
          onTahrirlandi={(yangi) => {
            // Ochiq oyna serverdan kelgan snapshot ustida ishlaydi — yangi
            // qiymatlar darhol ko'rinsin. Yutilgan zakazda to'lov belgilansa
            // server kirim/qarzni darhol yozadi, shuning uchun moliya bloki
            // ham shu yerda yangilanadi (AYNI qoidadan: kirimUlushi/qarzUlushi).
            const kirimSumma = yangi.transactionId ? kirimUlushi(yangi.summa, yangi.tolangan) : 0;
            const qarzQoldiq = yangi.debtId ? qarzUlushi(yangi.summa, yangi.tolangan, yangi.tolovTuri) : 0;
            setTanlangan({ ...tanlangan, ...yangi, kirimSumma, qarzQoldiq });
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
            // Endigina yutilgan zakaz "Yutildi" ustunining ENG TEPASIDA
            // ko'rinsin — `router.refresh()` javobini kutmasdan.
            mahalliyYoz(yakunlanadi, "YUTILDI");
            setYakunlanadi(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
