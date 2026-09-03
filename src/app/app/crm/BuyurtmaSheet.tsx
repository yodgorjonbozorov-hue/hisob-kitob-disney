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
import { ZakazMoliya } from "./ZakazMoliya";
import { ZakazTarix, type ActivityDTO } from "./ZakazTarix";
import type {
  BuyurtmaDTO,
  KategoriyaDTO,
  SotuvchiDTO,
  XodimKategoriyaDTO,
  ZakazSotuvchiDTO,
  ZakazXodimDTO,
} from "./turlar";

/**
 * TEZ AMALLAR (10-talab) — ustunga qarab. Har ustunda faqat MA'NOLI
 * o'tishlar ko'rinadi, shunda sotuvchi noto'g'ri tugmani bosolmaydi.
 */
function tezAmallar(ustun: Ustun): { ustun: Ustun; matn: string }[] {
  if (ustun === "KUTILAYOTGAN") return [{ ustun: "BUGUNGI", matn: "Bugungi zakazga o'tkazish" }];
  if (ustun === "BUGUNGI") return [{ ustun: "JARAYONDA", matn: "Jarayonga o'tkazish" }];
  if (ustun === "JARAYONDA") return [{ ustun: "YUTILDI", matn: "Yutildi" }];
  return [];
}

/**
 * ZAKAZ TAFSILOTI: tez amallar (sudrab tashlashga mobil muqobil),
 * moliyaviy natija, xodimlar, tez izoh va timeline.
 */
export function BuyurtmaSheet({
  b,
  ustun,
  bugun,
  kategoriyalar,
  xodimKategoriyalari,
  sotuvchilar,
  sotuvchiOzgartira,
  jamoaHuquqi,
  bahoYozaOladi,
  meId,
  onUstunga,
  onYoqotildi,
  onTahrirlandi,
  onClose,
}: {
  b: BuyurtmaDTO;
  ustun: Ustun;
  bugun: string;
  /** Kirim modulining kategoriyalari — tahrirlash uchun (CRM alohida ro'yxat yuritmaydi). */
  kategoriyalar: KategoriyaDTO[];
  /** Xodim kategoriyalari (Diktor/Dekorator/...) — bajaruvchi tahriri uchun. */
  xodimKategoriyalari: XodimKategoriyaDTO[];
  /** Sotuvchilar ro'yxati — sotuvchini almashtirish uchun. */
  sotuvchilar: SotuvchiDTO[];
  /** `crm.sotuvchi` huquqi (27-talab). */
  sotuvchiOzgartira: boolean;
  /** `crm.jamoa` huquqi — mavjud zakaz jamoasini o'zgartirish. */
  jamoaHuquqi: boolean;
  /** `crm.baho` huquqi — sifat nazorati. */
  bahoYozaOladi: boolean;
  meId: string;
  onUstunga: (u: Ustun) => void;
  onYoqotildi: () => void;
  onTahrirlandi: (yangi: {
    categoryId: string;
    kategoriya: string;
    summa: number;
    tolangan: number;
    tolovTuri: string | null;
    debtId: string | null;
    transactionId: string | null; // server yutilgan zakazda moliyani darhol yozadi
  }) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityDTO[] | null>(null);
  const [zakazXodimlar, setZakazXodimlar] = useState<ZakazXodimDTO[] | null>(null);
  const [sotuvchi, setSotuvchi] = useState<ZakazSotuvchiDTO | null>(b.sotuvchi);
  const [baho, setBaho] = useState<ZakazBahoDTO | null>(null);
  const [tasdiq, setTasdiq] = useState(false);
  const kirimBor = Boolean(b.transactionId);
  // Jamoani o'zgartirish (37-talab): huquq yoki zakazning o'z mas'uli
  // (yakunlangunga qadar) — server ham AYNI qoidani tekshiradi.
  const jamoaOzgartira = jamoaHuquqi || (b.masulId === meId && b.holat !== "YUTILDI");
  const moliyaYozilgan = Boolean(b.transactionId || b.debtId);
  const kechikkan = kechikkanKun(b.holat, b.sana, bugun);
  const tolov = tolovHolati(b.summa, b.tolangan, b.tolovTuri);

  const yuklash = useCallback(async () => {
    const res = await fetch(`/api/crm/deals/${b.id}`);
    if (res.ok) {
      const data = await res.json();
      setActivities(data.activities ?? []);
      setZakazXodimlar(data.xodimlar ?? []);
      setSotuvchi(data.sotuvchi ?? null);
      setBaho(data.baho ?? null);
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
            <Badge tone={TOLOV_BELGISI[tolov].tone}>
              {TOLOV_HOLAT_NOMI[tolov]}
              {tolov === "QISMAN" ? `: ${formatMoney(b.tolangan)}` : ""}
            </Badge>
            {kechikkan > 0 && <Badge tone="chiqim">🔴 {kechikkan} kun kechikkan</Badge>}
          </div>
          {b.izoh && <p className="text-xs text-muted whitespace-pre-line pt-1">{b.izoh}</p>}
        </div>

        {/* TEZ AMALLAR — mobilda sudrab tashlashning muqobili. */}
        <div className="flex gap-2 flex-wrap">
          {tezAmallar(ustun).map((a) => (
            <button
              key={a.ustun}
              onClick={() => onUstunga(a.ustun)}
              className="flex-1 min-w-[8rem] rounded-lg bg-brand text-white text-sm font-medium py-2"
            >
              {a.matn}
            </button>
          ))}
          {ustun !== "YUTILDI" && ustun !== "YOQOTILDI" && (
            <button
              onClick={onYoqotildi}
              className="flex-1 min-w-[8rem] rounded-lg border border-line text-sm font-medium py-2 text-expense"
            >
              Yo&apos;qotildi
            </button>
          )}
        </div>

        {/* Kategoriya/narx/to'lov — faqat moliyaga o'tmagan zakazda (server ham qulflaydi). */}
        {!moliyaYozilgan && (
          <BuyurtmaTahrir b={b} kategoriyalar={kategoriyalar} onSaqlandi={onTahrirlandi} />
        )}

        {/* SOTUVCHI (10-talab) — bajaruvchilardan alohida, birinchi o'rinda. */}
        <ZakazSotuvchisiBlok
          dealId={b.id}
          sotuvchi={sotuvchi}
          sotuvchilar={sotuvchilar}
          ozgartira={sotuvchiOzgartira}
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
