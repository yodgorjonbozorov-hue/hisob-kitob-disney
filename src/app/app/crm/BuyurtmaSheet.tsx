"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { kechikkanKun, tolovHolati, type Ustun } from "@/lib/crm/pipeline";
import { YakunlashTasdiq } from "./YakunlashTasdiq";
import { BuyurtmaTahrir } from "./BuyurtmaTahrir";
import { ZakazSarlavha } from "./ZakazSarlavha";
import { ZakazXodimlariBlok } from "./ZakazXodimlari";
import { ijroKategoriyalari } from "./ZakazJamoasi";
import { ZakazBahoBlok } from "./ZakazBaho";
import { ZakazSotuvchisiBlok } from "./ZakazSotuvchisi";
import type { ZakazBahoDTO } from "@/lib/services/zakazBaho";
import { ZakazAmalPaneli } from "./ZakazAmalPaneli";
import { ZakazDirektorTahriri } from "./ZakazDirektorTahriri";
import { ZakazMoliya } from "./ZakazMoliya";
import { ZakazTolovlari } from "./ZakazTolovlari";
import { ZakazTarix, type ActivityDTO } from "./ZakazTarix";
import type {
  BuyurtmaDTO,
  KategoriyaDTO,
  SotuvchiDTO,
  XodimDTO,
  XodimKategoriyaDTO,
  ZakazSotuvchiDTO,
  ZakazTolovHisobiDTO,
  ZakazXodimDTO,
} from "./turlar";

/**
 * ZAKAZ TAFSILOTI: tez amallar (sudrab tashlashga mobil muqobil),
 * moliyaviy natija, xodimlar, tez izoh va timeline.
 */
export function BuyurtmaSheet({
  b,
  ustun,
  bugun,
  boshqaruvchi,
  kategoriyalar,
  xodimlar,
  xodimKategoriyalari,
  sotuvchilar,
  jamoaHuquqi,
  bahoYozaOladi,
  meId,
  onUstunga,
  onYoqotildi,
  onOchirish,
  onTahrirlandi,
  onClose,
}: {
  b: BuyurtmaDTO;
  ustun: Ustun;
  bugun: string;
  /** OWNER/ADMIN mi — arxivdan qaytarish va o'chirish tugmalari uchun. */
  boshqaruvchi: boolean;
  /** Kirim modulining kategoriyalari — tahrirlash uchun (CRM alohida ro'yxat yuritmaydi). */
  kategoriyalar: KategoriyaDTO[];
  /** Shu biznesning faol xodimlari — mas'ulni almashtirish uchun. */
  xodimlar: XodimDTO[];
  /** Xodim kategoriyalari (Diktor/Dekorator/...) — bajaruvchi tahriri uchun. */
  xodimKategoriyalari: XodimKategoriyaDTO[];
  /** Sotuvchilar ro'yxati — sotuvchini almashtirish uchun. */
  sotuvchilar: SotuvchiDTO[];
  /** `crm.jamoa` huquqi — mavjud zakaz jamoasini o'zgartirish. */
  jamoaHuquqi: boolean;
  /** `crm.baho` huquqi — sifat nazorati. */
  bahoYozaOladi: boolean;
  meId: string;
  onUstunga: (u: Ustun) => void;
  onYoqotildi: () => void;
  /** Zakazni o'chirish (tasdiq oynasi doskada ochiladi) — faqat direktor. */
  onOchirish: () => void;
  onTahrirlandi: (yangi: { categoryId: string; kategoriya: string; summa: number }) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityDTO[] | null>(null);
  const [zakazXodimlar, setZakazXodimlar] = useState<ZakazXodimDTO[] | null>(null);
  const [sotuvchi, setSotuvchi] = useState<ZakazSotuvchiDTO | null>(b.sotuvchi);
  const [baho, setBaho] = useState<ZakazBahoDTO | null>(null);
  // TO'LOV HISOBI — SERVERDAN (doskadagi snapshot emas): oyna ochilganda
  // yuklanadi va har to'lovdan keyin javob bilan yangilanadi.
  const [tolovHisobi, setTolovHisobi] = useState<ZakazTolovHisobiDTO | null>(null);
  const [tasdiq, setTasdiq] = useState(false);
  const kirimBor = Boolean(b.transactionId);
  // Jamoani o'zgartirish (37-talab): huquq yoki zakazning o'z mas'uli
  // (yakunlangunga qadar) — server ham AYNI qoidani tekshiradi.
  const jamoaOzgartira = jamoaHuquqi || (b.masulId === meId && b.holat !== "YUTILDI");
  const kechikkan = kechikkanKun(b.holat, b.sana, bugun);
  // Server hisobi kelgunga qadar doskadagi snapshot ko'rsatiladi.
  const summa = tolovHisobi?.summa ?? b.summa;
  const tolangan = tolovHisobi?.tolangan ?? b.tolangan;
  const tolov = tolovHolati(summa, tolangan, b.tolovTuri);
  // TO'LOV QO'SHISH: yakunlanmagan va qarzga yopilmagan zakazda. Yutilgan
  // zakazning puli to'liq kelgan; qarzga yopilganida esa qolgan pul
  // Qarzdorlik bo'limidan qabul qilinadi (server ham shuni majburlaydi).
  const tolovQoshaOladi = b.holat !== "YUTILDI" && b.holat !== "YOQOTILDI" && !b.debtId;

  const yuklash = useCallback(async () => {
    const res = await fetch(`/api/crm/deals/${b.id}`);
    if (res.ok) {
      const data = await res.json();
      setActivities(data.activities ?? []);
      setZakazXodimlar(data.xodimlar ?? []);
      setSotuvchi(data.sotuvchi ?? null);
      setBaho(data.baho ?? null);
      setTolovHisobi(data.tolovHisobi ?? null);
    }
  }, [b.id]);

  useEffect(() => {
    void yuklash();
  }, [yuklash]);

  async function vazifaYaratish() {
    const nomi = prompt("Vazifa nomi:", `${b.nomi} — keyingi qadam`);
    if (!nomi?.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomi: nomi.trim(), dealId: b.id }),
    });
    alert(res.ok ? "Vazifa yaratildi — Vazifalar bo'limida ko'rasiz." : (await res.json()).error ?? "Vazifa yaratilmadi");
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-line p-5 space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <ZakazSarlavha
          b={b}
          ustun={ustun}
          tolov={tolov}
          tolangan={tolangan}
          kechikkan={kechikkan}
          sotuvchiBor={Boolean(sotuvchi)}
        />

        <ZakazAmalPaneli
          b={b}
          ustun={ustun}
          boshqaruvchi={boshqaruvchi}
          onUstunga={onUstunga}
          onYoqotildi={onYoqotildi}
          onOchirish={onOchirish}
        />

        {/* TO'LOVLAR — jami / to'langan / qoldiq va to'lovlar tarixi.
            Zakazning eng ko'p qaraladigan bloki, shuning uchun yuqorida. */}
        <ZakazTolovlari
          dealId={b.id}
          hisob={tolovHisobi}
          qoshaOladi={tolovQoshaOladi}
          boshqaruvchi={boshqaruvchi}
          onYangilandi={(yangi) => {
            setTolovHisobi(yangi);
            // Doska kartochkasidagi raqamlar ham yangilansin.
            router.refresh();
          }}
        />

        {/* Kategoriya va narx — zakaz yakunlangunga qadar tuzatiladi
            (kategoriya kirim yozilgach qulflanadi; server ham tekshiradi). */}
        {b.holat !== "YUTILDI" && !b.debtId && (
          <BuyurtmaTahrir
            b={b}
            kategoriyalar={kategoriyalar}
            kategoriyaQulf={Boolean(b.transactionId)}
            tolangan={tolangan}
            onSaqlandi={onTahrirlandi}
          />
        )}

        {/* Pulga tegmaydigan tuzatishlar — moliyaga o'tgan zakazda ham ochiq. */}
        {boshqaruvchi && (
          <ZakazDirektorTahriri
            b={b}
            xodimlar={xodimlar}
            onSaqlandi={() => {
              void yuklash();
              router.refresh();
            }}
          />
        )}

        {/* SOTUVCHI (10-talab) — bajaruvchilardan alohida, birinchi o'rinda. */}
        <ZakazSotuvchisiBlok
          dealId={b.id}
          sotuvchi={sotuvchi}
          sotuvchilar={sotuvchilar}
          onSaqlandi={() => {
            void yuklash();
            router.refresh();
          }}
        />

        {/* Zakaz jamoasi (33-talab): lavozim bo'yicha guruhlangan + tahrir. */}
        <ZakazXodimlariBlok
          dealId={b.id}
          kirimBor={kirimBor}
          ozgartira={jamoaOzgartira}
          kategoriyalar={ijroKategoriyalari(xodimKategoriyalari)}
          xodimlar={zakazXodimlar}
          onSaqlandi={() => {
            void yuklash();
            router.refresh();
          }}
        />

        {/* Sifat nazorati (24/25-talab) — faqat yakunlangan zakazda. */}
        {b.holat === "YUTILDI" && (
          <ZakazBahoBlok dealId={b.id} baho={baho} yozaOladi={bahoYozaOladi} onSaqlandi={() => void yuklash()} />
        )}

        <ZakazMoliya
          b={b}
          yakunlanganmi={ustun === "YUTILDI"}
          onYakunlash={() => setTasdiq(true)}
          onClose={onClose}
        />

        <button onClick={vazifaYaratish} className="text-brand text-sm font-medium">
          + Vazifa yaratish
        </button>

        <ZakazTarix dealId={b.id} activities={activities} onYangilandi={() => void yuklash()} />
      </div>

      {tasdiq && (
        <YakunlashTasdiq
          b={b}
          onClose={() => setTasdiq(false)}
          onDone={() => {
            setTasdiq(false);
            onClose();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
