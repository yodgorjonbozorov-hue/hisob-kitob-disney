"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kirimUlushi, qarzUlushi, zakazUstuni, type Ustun } from "@/lib/crm/pipeline";
import { BuyurtmaModal } from "./BuyurtmaModal";
import { BuyurtmaSheet } from "./BuyurtmaSheet";
import { DoskaFiltr } from "./DoskaFiltr";
import { YakunlashTasdiq } from "./YakunlashTasdiq";
import { YoqotishSababiModal } from "./YoqotishSababiModal";
import { ZakazOchirishTasdiq } from "./ZakazOchirishTasdiq";
import { ZakazUstuni } from "./ZakazUstuni";
import { useUstunSahifalari } from "./useUstunSahifalari";
import { useOptimistikKochish } from "./useOptimistikKochish";
import { useZakazAmallari } from "./useZakazAmallari";
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
 * Kutilayotgan → Bugungi → Jarayonda → Yutildi (+ direktorda: Yo'qotildi).
 * Ustun BAZADAN o'qilmaydi — u `holat` va `sana` dan hisoblanadi
 * (`lib/crm/pipeline.ts`), server bilan bir xil qoida bo'yicha.
 *
 * ═══ YO'QOTILDI USTUNI ═══
 * Oddiy xodimda avvalgidek 4 ta ustun (mobil svayp ham shunga moslangan).
 * Direktorda BESHINCHISI qo'shiladi: yo'qotilgan zakaz o'chib ketmasin,
 * u yerda mijoz, telefon, summa, sotuvchi va YO'QOTISH SABABI ko'rinadi va
 * zakazni boshqa holatga qaytarish mumkin. Ustunlar ro'yxati SERVERDAN
 * keladi (`page.tsx`) — sahifa faqat kelgan sahifalarni chizadi.
 *
 * Uch mantiq alohida modullarda: ustun sahifalari (`useUstunSahifalari`),
 * optimistik ko'chish (`useOptimistikKochish`) va server amallari
 * (`useZakazAmallari`).
 */
export function CrmClient({
  sahifalar,
  ustunlar,
  boshqaruvchi,
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
  /** Chiziladigan ustunlar — direktorda "Yo'qotildi" ham bor. */
  ustunlar: Ustun[];
  /** OWNER/ADMIN mi — o'chirish va "Yutildi"dan qaytarish tugmalari uchun. */
  boshqaruvchi: boolean;
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
  const [yoqotiladi, setYoqotiladi] = useState<BuyurtmaDTO | null>(null);
  const [ochiriladi, setOchiriladi] = useState<BuyurtmaDTO | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const ustuni = (b: BuyurtmaDTO): Ustun => zakazUstuni(b.holat, b.sana, bugun);

  const amallar = useZakazAmallari({ bugun, onOzgardi: mahalliyYoz });

  /** Ustunga ko'chirish. "Yutildi" va "Yo'qotildi" — tasdiq oynasi orqali. */
  function ustunga(id: string, ustun: Ustun) {
    const b = zakazlar.find((x) => x.id === id) ?? (tanlangan?.id === id ? tanlangan : undefined);
    if (!b || ustuni(b) === ustun) return;
    setTanlangan(null);
    if (ustun === "YUTILDI") return setYakunlanadi(b);
    if (ustun === "YOQOTILDI") return setYoqotiladi(b);
    void amallar.ustungaKochirish(b, ustun);
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
        {(amallar.xato ?? sahifaXatosi) && (
          <p className="text-expense text-sm">{amallar.xato ?? sahifaXatosi}</p>
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
        {ustunlar.map((u) => (
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
              onDrop={() => dragId && ustunga(dragId, u)}
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
          boshqaruvchi={boshqaruvchi}
          kategoriyalar={kategoriyalar}
          xodimlar={xodimlar}
          xodimKategoriyalari={xodimKategoriyalari}
          sotuvchilar={sotuvchilar}
          jamoaHuquqi={jamoaHuquqi}
          bahoYozaOladi={bahoYozaOladi}
          meId={meId}
          onUstunga={(u) => ustunga(tanlangan.id, u)}
          onYoqotildi={() => {
            setYoqotiladi(tanlangan);
            setTanlangan(null);
          }}
          onOchirish={() => {
            setOchiriladi(tanlangan);
            setTanlangan(null);
          }}
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
      {yoqotiladi && (
        <YoqotishSababiModal
          b={yoqotiladi}
          band={amallar.band}
          onClose={() => setYoqotiladi(null)}
          onTasdiq={async (sabab) => {
            if (await amallar.yoqotildi(yoqotiladi, sabab)) setYoqotiladi(null);
          }}
        />
      )}
      {ochiriladi && (
        <ZakazOchirishTasdiq
          b={ochiriladi}
          band={amallar.band}
          onClose={() => setOchiriladi(null)}
          onTasdiq={async () => {
            if (await amallar.ochirish(ochiriladi)) setOchiriladi(null);
          }}
        />
      )}
    </div>
  );
}
