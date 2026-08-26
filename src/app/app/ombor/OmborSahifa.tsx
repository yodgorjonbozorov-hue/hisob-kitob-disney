"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { KpiKartalar } from "./KpiKartalar";
import { MahsulotlarTab } from "./MahsulotlarTab";
import { TaminotlarTab } from "./TaminotlarTab";
import { InventarizatsiyaTab } from "./InventarizatsiyaTab";
import { MahsulotDetal } from "./MahsulotDetal";
import { MahsulotTahrir } from "./MahsulotTahrir";
import { YangiMahsulot } from "./YangiMahsulot";
import { TovarKeldi } from "./TovarKeldi";
import { TogrilashSheet, type TogrilashTuri } from "./TogrilashSheet";
import { ImportModal } from "./ImportModal";
import { KatalogTozalashModal } from "./KatalogTozalashModal";
import { OmborBoshqaruv, OmborFab, type QoshimchaAmal } from "./OmborBoshqaruv";
import { OMBOR_TABLAR, type OmborTab } from "./tablar";
import type { AccountDTO } from "@/lib/queries/accounts";
import type { SupplierDTO } from "@/lib/queries/xarid";
import type { StockAdjustmentDTO } from "@/lib/queries/inventory";
import type {
  OmborKategoriyaDTO,
  OmborKpiDTO,
  OmborMahsulotDTO,
  OmborRoyxatDTO,
  TaminotRoyxatDTO,
} from "@/lib/queries/ombor";

/**
 * OMBOR — bitta sahifa, uchta tab, BITTA asosiy amal.
 *
 * Sahifada nima ko'rinishi tartibi ataylab shunday: avval "nima bor" (KPI),
 * keyin "nima qilaman" (+ Tovar keldi), keyin ma'lumot. Ikkinchi darajali
 * amallar "•••" ichida, telefonda esa pastki o'ngdagi FAB'da — asosiy
 * ekran tugmalar bilan to'ldirilmaydi.
 */
export function OmborSahifa({
  tab,
  biznesNomi,
  kpi,
  kategoriyalar,
  boshlangichRoyxat,
  taminotchilar,
  kassalar,
  taminotlar,
  togrilashlar,
}: {
  tab: OmborTab;
  biznesNomi: string;
  kpi: OmborKpiDTO;
  kategoriyalar: OmborKategoriyaDTO[];
  boshlangichRoyxat: OmborRoyxatDTO;
  taminotchilar: SupplierDTO[];
  kassalar: AccountDTO[];
  taminotlar: TaminotRoyxatDTO | null;
  togrilashlar: StockAdjustmentDTO[] | null;
}) {
  const router = useRouter();
  const [tovarKeldi, setTovarKeldi] = useState(false);
  const [yangiMahsulot, setYangiMahsulot] = useState(false);
  const [detal, setDetal] = useState<string | null>(null);
  const [tahrir, setTahrir] = useState<OmborMahsulotDTO | null>(null);
  const [togrilash, setTogrilash] = useState<TogrilashTuri | null>(null);
  const [importOchiq, setImportOchiq] = useState(false);
  const [tozalashOchiq, setTozalashOchiq] = useState(false);

  /** Serverdan yangi KPI va ro'yxat — har yozuv amalidan keyin. */
  const yangila = () => router.refresh();

  const qoshimcha: QoshimchaAmal[] = [
    { nomi: "➕ Yangi mahsulot", onClick: () => setYangiMahsulot(true) },
    { nomi: "📋 Inventarizatsiya", onClick: () => setTogrilash("inventarizatsiya") },
    { nomi: "➖ Hisobdan chiqarish", onClick: () => setTogrilash("chiqarish") },
    { nomi: "📊 Excel eksport", href: "/api/products/export?format=xlsx", yuklab: true },
    { nomi: "📥 Fayldan yuklash", onClick: () => setImportOchiq(true) },
    { nomi: "🧹 Katalogni tozalash", onClick: () => setTozalashOchiq(true) },
    { nomi: "🏷 Narx va qoldiq", href: "/app/ombor/narxlar" },
    { nomi: "🚚 Ta'minotchilar", href: "/app/ombor/taminotchilar" },
  ];

  const fabAmallari: QoshimchaAmal[] = [
    { nomi: "📦 Tovar keldi", onClick: () => setTovarKeldi(true) },
    ...qoshimcha.filter((a) => !a.href),
  ];

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Ombor</h1>
          <p className="text-sm text-muted mt-0.5">
            Mahsulotlar, qoldiq va yangi kelgan tovarlarni boshqaring
          </p>
          <p className="text-2xs text-faint mt-0.5 truncate">{biznesNomi}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={() => setTovarKeldi(true)} className="hidden sm:inline-flex">
            + Tovar keldi
          </Button>
          <div className="hidden lg:block">
            <OmborBoshqaruv amallar={qoshimcha} />
          </div>
        </div>
      </header>

      <KpiKartalar kpi={kpi} />

      <nav className="flex gap-1 border-b border-line overflow-x-auto" aria-label="Ombor bo'limlari">
        {OMBOR_TABLAR.map((t) => (
          <Link
            key={t.kalit}
            href={`/app/ombor?tab=${t.kalit}`}
            scroll={false}
            aria-current={t.kalit === tab ? "page" : undefined}
            className={`shrink-0 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition min-h-[44px] ${
              t.kalit === tab
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.nomi}
          </Link>
        ))}
      </nav>

      {tab === "mahsulotlar" && (
        <MahsulotlarTab
          boshlangich={boshlangichRoyxat}
          kategoriyalar={kategoriyalar}
          onTanla={(m) => setDetal(m.id)}
          onTovarKeldi={() => setTovarKeldi(true)}
          onYangiMahsulot={() => setYangiMahsulot(true)}
        />
      )}

      {tab === "taminotlar" && taminotlar && (
        <TaminotlarTab
          royxat={taminotlar}
          onTovarKeldi={() => setTovarKeldi(true)}
          onYangilandi={yangila}
        />
      )}

      {tab === "inventarizatsiya" && togrilashlar && (
        <InventarizatsiyaTab
          togrilashlar={togrilashlar}
          onInventarizatsiya={() => setTogrilash("inventarizatsiya")}
          onChiqarish={() => setTogrilash("chiqarish")}
        />
      )}

      <OmborFab amallar={fabAmallari} />

      {tovarKeldi && (
        <TovarKeldi
          taminotchilar={taminotchilar.map((t) => ({ id: t.id, nomi: t.nomi }))}
          kassalar={kassalar}
          kategoriyalar={kategoriyalar}
          onClose={() => setTovarKeldi(false)}
          onDone={yangila}
        />
      )}

      {yangiMahsulot && (
        <YangiMahsulot
          kategoriyalar={kategoriyalar}
          onClose={() => setYangiMahsulot(false)}
          onDone={() => {
            setYangiMahsulot(false);
            yangila();
          }}
        />
      )}

      {detal && (
        <MahsulotDetal
          productId={detal}
          onClose={() => setDetal(null)}
          onTovarKeldi={() => {
            setDetal(null);
            setTovarKeldi(true);
          }}
          onTahrirla={(m) => {
            setDetal(null);
            setTahrir(m);
          }}
        />
      )}

      {tahrir && (
        <MahsulotTahrir
          mahsulot={tahrir}
          kategoriyalar={kategoriyalar}
          onClose={() => setTahrir(null)}
          onDone={yangila}
        />
      )}

      {togrilash && (
        <TogrilashSheet turi={togrilash} onClose={() => setTogrilash(null)} onDone={yangila} />
      )}

      {importOchiq && <ImportModal onClose={() => setImportOchiq(false)} onDone={yangila} />}
      {tozalashOchiq && (
        <KatalogTozalashModal onClose={() => setTozalashOchiq(false)} onDone={yangila} />
      )}
    </div>
  );
}
