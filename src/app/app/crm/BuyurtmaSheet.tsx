"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, formatDateUZ } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import {
  kechikkanKun,
  tolovHolati,
  TOLOV_HOLAT_NOMI,
  USTUN_NOMI,
  type Ustun,
} from "@/lib/crm/pipeline";
import { YakunlashTasdiq } from "./YakunlashTasdiq";
import { BuyurtmaTahrir } from "./BuyurtmaTahrir";
import { TOLOV_BELGISI } from "./BuyurtmaKarta";
import { ZakazXodimlariBlok } from "./ZakazXodimlari";
import { ijroKategoriyalari } from "./ZakazJamoasi";
import { ZakazBahoBlok } from "./ZakazBaho";
import { ZakazSotuvchisiBlok } from "./ZakazSotuvchisi";
import type { ZakazBahoDTO } from "@/lib/services/zakazBaho";
import { ZakazAmalPaneli } from "./ZakazAmalPaneli";
import { ZakazDirektorTahriri } from "./ZakazDirektorTahriri";
import { ZakazMoliya } from "./ZakazMoliya";
import { ZakazTolovlari } from "./ZakazTolovlari";
import type { ZakazTolovHisobiDTO } from "@/lib/crm/tolovOqish";
import { ZakazTarix, type ActivityDTO } from "./ZakazTarix";
import type {
  BuyurtmaDTO,
  KategoriyaDTO,
  SotuvchiDTO,
  XodimDTO,
  XodimKategoriyaDTO,
  ZakazSotuvchiDTO,
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
  /**
   * Ochiq oynadagi zakaz maydonlari o'zgardi (narx, to'lov, moliya) —
   * doska shu qismlarni mahalliy yozib qo'yadi. `Partial` ataylab:
   * chaqiruvchi faqat O'ZGARGANINI uzatadi, qolgani eski suratdan qoladi.
   */
  onTahrirlandi: (yangi: Partial<BuyurtmaDTO>) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityDTO[] | null>(null);
  const [zakazXodimlar, setZakazXodimlar] = useState<ZakazXodimDTO[] | null>(null);
  const [sotuvchi, setSotuvchi] = useState<ZakazSotuvchiDTO | null>(b.sotuvchi);
  const [baho, setBaho] = useState<ZakazBahoDTO | null>(null);
  // TO'LOV HISOBI — serverdagi HOLAT (`lib/crm/tolovOqish.ts`). Doskadan
  // kelgan surat emas: aynan eski suratga tayanish tufayli aralash
  // to'lovning bir qismi ekrandan yo'qolib qolardi.
  const [tolov, setTolov] = useState<ZakazTolovHisobiDTO | null>(null);
  const [tasdiq, setTasdiq] = useState(false);
  const kirimBor = Boolean(b.transactionId);
  // Jamoani o'zgartirish (37-talab): huquq yoki zakazning o'z mas'uli
  // (yakunlangunga qadar) — server ham AYNI qoidani tekshiradi.
  const jamoaOzgartira = jamoaHuquqi || (b.masulId === meId && b.holat !== "YUTILDI");
  const kechikkan = kechikkanKun(b.holat, b.sana, bugun);
  // To'lov belgisi: hisob kelgan bo'lsa serverdan, aks holda kartadagi surat.
  const tolangan = tolov?.tolangan ?? b.tolangan;
  const tolovHolat = tolov?.holati ?? tolovHolati(b.summa, b.tolangan, b.tolovTuri);

  const yuklash = useCallback(async () => {
    const res = await fetch(`/api/crm/deals/${b.id}`);
    if (res.ok) {
      const data = await res.json();
      setActivities(data.activities ?? []);
      setZakazXodimlar(data.xodimlar ?? []);
      setSotuvchi(data.sotuvchi ?? null);
      setBaho(data.baho ?? null);
      if (data.tolov) setTolov(data.tolov as ZakazTolovHisobiDTO);
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
        <div className="space-y-1">
          {b.kategoriya && (
            <p className="text-2xs font-semibold text-brand uppercase tracking-wide">{b.kategoriya}</p>
          )}
          <h2 className="font-semibold text-fg text-lg">{b.nomi}</h2>
          <p className="text-sm text-muted">
            {b.kontakt ?? "Mijozsiz"}
            {b.tel ? ` · ${b.tel}` : ""}
          </p>
          <p className="text-sm text-fg tnum">
            {b.summa > 0 ? formatMoney(b.summa) : "Narx kiritilmagan"}
            {b.sana ? ` · ${formatDateUZ(new Date(b.sana))}` : ""}
          </p>
          {b.masulIsm && !sotuvchi && <p className="text-xs text-faint">Mas&apos;ul: {b.masulIsm}</p>}
          <div className="flex gap-1.5 flex-wrap pt-1">
            <Badge tone="neutral">{USTUN_NOMI[ustun]}</Badge>
            <Badge tone={TOLOV_BELGISI[tolovHolat].tone}>
              {TOLOV_HOLAT_NOMI[tolovHolat]}
              {tolovHolat === "QISMAN" ? `: ${formatMoney(tolangan)}` : ""}
            </Badge>
            {kechikkan > 0 && <Badge tone="chiqim">🔴 {kechikkan} kun kechikkan</Badge>}
          </div>
          {b.izoh && <p className="text-xs text-muted whitespace-pre-line pt-1">{b.izoh}</p>}
        </div>

        <ZakazAmalPaneli
          b={b}
          ustun={ustun}
          boshqaruvchi={boshqaruvchi}
          onUstunga={onUstunga}
          onYoqotildi={onYoqotildi}
          onOchirish={onOchirish}
        />

        {/* Kategoriya va narx. Kirim/qarz yozilgan bo'lsa tegishli maydon
            qulflanadi — server ham AYNI qoidani mustaqil majburlaydi. */}
        <BuyurtmaTahrir
          b={b}
          kategoriyalar={kategoriyalar}
          kirimBor={kirimBor}
          qarzBor={Boolean(b.debtId)}
          tolangan={tolangan}
          onSaqlandi={(yangi) => {
            onTahrirlandi(yangi);
            void yuklash();
          }}
        />

        {/* TO'LOVLAR — Jami / To'langan / Qoldiq, to'lov tarixi va yangi
            to'lov qo'shish. To'lov QO'SHILADI: oldingilari yuvilmaydi. */}
        <ZakazTolovlari
          dealId={b.id}
          hisob={tolov}
          qulf={Boolean(b.debtId)}
          onYangilandi={(h) => {
            setTolov(h);
            onTahrirlandi({
              tolangan: h.tolangan,
              tolovTuri: h.tolovTuri,
              tolovlar: h.tolovlar.map((t) => ({ id: t.id, kanal: t.kanal, summa: t.summa })),
              kirimSumma: h.kirimSumma,
              transactionId: h.transactionId,
              debtId: h.debtId,
              qarzQoldiq: h.qarzQoldiq,
              qarzOchiq: h.qarzOchiq,
            });
            router.refresh();
          }}
        />

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
          tosiq={tolov?.yutishTosigi ?? null}
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
          tosiq={tolov?.yutishTosigi ?? null}
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
