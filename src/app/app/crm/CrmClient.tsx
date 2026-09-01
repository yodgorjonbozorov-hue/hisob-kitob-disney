"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { BuyurtmaKarta } from "./BuyurtmaKarta";
import { BuyurtmaModal } from "./BuyurtmaModal";
import { BuyurtmaSheet } from "./BuyurtmaSheet";
import { KirimTasdiq } from "./KirimTasdiq";
import { Select } from "@/components/ui/Select";
import type {
  BuyurtmaDTO,
  KategoriyaDTO,
  SotuvchiDTO,
  StageDTO,
  XodimDTO,
  XodimKategoriyaDTO,
} from "./turlar";

const STAGE_RANG: Record<string, string> = {
  OPEN: "border-line",
  WON: "border-income/50",
  LOST: "border-expense/40",
};

/**
 * CRM kanban doskasi — kunlik buyurtmalar.
 * Yangi → Aloqa qilindi → Taklif yuborildi → Yutildi → Yo'qotildi.
 */
export function CrmClient({
  stages,
  buyurtmalar,
  kategoriyalar,
  xodimlar,
  xodimKategoriyalari,
  sotuvchilar,
  ozimSotuvchi,
  sotuvchiMajburiy,
  sotuvchiOzgartira,
  meId,
  bugun,
}: {
  stages: StageDTO[];
  buyurtmalar: BuyurtmaDTO[];
  kategoriyalar: KategoriyaDTO[];
  xodimlar: XodimDTO[];
  /** Xodim kategoriyalari (Diktor/Dekorator/...) — bajaruvchi biriktiruvi uchun. */
  xodimKategoriyalari: XodimKategoriyaDTO[];
  /** Sotuvchilar — forma selektori va doska filtri uchun. */
  sotuvchilar: SotuvchiDTO[];
  /** Joriy foydalanuvchining sotuvchi profili (avto-tanlash). */
  ozimSotuvchi: string | null;
  sotuvchiMajburiy: boolean;
  sotuvchiOzgartira: boolean;
  meId: string;
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
  const [kirimTasdiq, setKirimTasdiq] = useState<BuyurtmaDTO | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  // SOTUVCHI FILTRI (25-talab). Doska bir marta yuklangani uchun saralash
  // shu yerda — qo'shimcha so'rov yubormaydi; server ham `?sotuvchiId=`
  // orqali ayni filtrni qo'llay oladi (API foydalanuvchilari uchun).
  const [filtrSotuvchi, setFiltrSotuvchi] = useState("");
  const korinadigan = filtrSotuvchi
    ? buyurtmalar.filter((b) => b.sotuvchi?.employeeId === filtrSotuvchi)
    : buyurtmalar;

  /**
   * Holatni o'zgartirish. "Yutildi" ga o'tkazishda kirim AVTOMATIK
   * yozilmaydi — tasdiq oynasi ochiladi (pul yozadigan amal hech qachon
   * sudrab tashlash bilan bo'lmasin).
   */
  async function kochirish(id: string, stage: StageDTO) {
    setXato(null);
    // Ochiq oynadagi snapshot ustunroq: kategoriya/narx endigina tahrirlangan
    // bo'lsa, serverdan kelgan ro'yxat hali eski qiymatni saqlab turadi.
    const b = tanlangan?.id === id ? tanlangan : buyurtmalar.find((x) => x.id === id);
    const res = await fetch(`/api/crm/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: stage.id }),
    });
    if (!res.ok) {
      setXato((await res.json()).error ?? "Xatolik yuz berdi");
      return;
    }
    setTanlangan(null);
    if (stage.turi === "WON" && b && b.summa > 0 && !b.transactionId) {
      setKirimTasdiq({ ...b, stageId: stage.id });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => setYangiOchiq(true)}
          className="bg-income text-white font-medium rounded-lg px-4 py-2 text-sm hover:brightness-110 transition"
        >
          + Yangi buyurtma
        </button>
        {sotuvchilar.length > 0 && (
          <div className="w-full sm:w-56">
            <Select
              value={filtrSotuvchi}
              onChange={setFiltrSotuvchi}
              searchable={sotuvchilar.length > 7}
              aria-label="Sotuvchi bo'yicha filtr"
              options={[
                { value: "", label: "Sotuvchi: barchasi" },
                ...sotuvchilar.map((s) => ({ value: s.id, label: s.ism })),
              ]}
            />
          </div>
        )}
        {xato && <p className="text-expense text-sm">{xato}</p>}
      </div>

      {/* Kanban — mobil/planshetda gorizontal siljiydi */}
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
        {stages.map((s) => {
          const ustun = korinadigan.filter((b) => b.stageId === s.id);
          const jami = ustun.reduce((a, b) => a + b.summa, 0);
          return (
            <div
              key={s.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId && kochirish(dragId, s)}
              className={`shrink-0 w-64 sm:w-72 bg-surface-2/60 rounded-2xl border ${
                STAGE_RANG[s.turi] ?? "border-line"
              } p-2.5`}
            >
              <div className="flex items-center justify-between px-1.5 pb-2">
                <p className="text-sm font-semibold text-fg">{s.nomi}</p>
                <p className="text-2xs text-faint tnum">
                  {ustun.length} ta{jami > 0 ? ` · ${formatMoney(jami)}` : ""}
                </p>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {ustun.map((b) => (
                  <BuyurtmaKarta
                    key={b.id}
                    b={b}
                    holat={s.nomi}
                    onClick={() => setTanlangan(b)}
                    onDragStart={() => setDragId(b.id)}
                    onDragEnd={() => setDragId(null)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {yangiOchiq && (
        <BuyurtmaModal
          kategoriyalar={kategoriyalar}
          stages={stages}
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
          stages={stages}
          kategoriyalar={kategoriyalar}
          xodimKategoriyalari={xodimKategoriyalari}
          sotuvchilar={sotuvchilar}
          sotuvchiOzgartira={sotuvchiOzgartira}
          onKochirish={(s) => kochirish(tanlangan.id, s)}
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
      {kirimTasdiq && (
        <KirimTasdiq
          b={kirimTasdiq}
          onClose={() => {
            setKirimTasdiq(null);
            router.refresh();
          }}
          onDone={() => {
            setKirimTasdiq(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
