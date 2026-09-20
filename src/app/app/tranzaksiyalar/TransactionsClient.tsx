"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { XodimlarHavola } from "./XodimlarHavola";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionList } from "./TransactionList";
import { SummaryBar } from "./SummaryBar";
import { YangiYozuv } from "./YangiYozuv";
import { ImportExportMenu } from "./ImportExportMenu";
import { ImportModal } from "./ImportModal";
import { BulkAmallar } from "./BulkAmallar";
import { KategoriyaKorinish } from "./KategoriyaKorinish";
import { YozuvOynalari, useYozuvOynalari } from "./YozuvOynalari";
import { useYozuvHolati } from "./useYozuvHolati";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { isManager } from "@/lib/auth/roles";
import type {
  KategoriyaJami,
  TransactionDTO,
} from "@/lib/queries/transactions";
import type { TezKategoriyalar } from "@/lib/queries/tezKategoriyalar";
import type { Rol } from "@/lib/auth/session";
import type { AccountOption, CategoryOption, FiltrQiymati, XodimOption } from "./turlar";
import {
  effektivFiltrQuery,
  faolFiltrSoni,
  ozgartirsaBoladi as ozgartirishMumkinmi,
} from "./turlar";

export function TransactionsClient({
  initialItems,
  initialTotal,
  page,
  pageSize,
  categories,
  accounts,
  standartKassa,
  masullar = [],
  xodimlar = [],
  xodimlarStat = false,
  tezKategoriyalar,
  currentUserId,
  currentUserRol,
  moveTargets = [],
  totals,
  kategoriyaJamlari,
  filters,
}: {
  initialItems: TransactionDTO[];
  initialTotal: number;
  page: number;
  pageSize: number;
  categories: CategoryOption[];
  accounts: AccountOption[];
  /** Formada oldindan tanlanadigan kassa — serverdagi qoida bilan AYNI. */
  standartKassa?: { naqd: string | null; click: string | null };
  /** Qarzga mas'ul qilib belgilash mumkin bo'lgan xodimlar. */
  masullar?: { id: string; ism: string }[];
  /** "Kim kiritdi" filtri uchun — faqat direktorga to'ldirilgan holda keladi. */
  xodimlar?: XodimOption[];
  /** "Xodimlar" statistika havolasi ko'rsatilsinmi (`hisobot.korish` huquqi). */
  xodimlarStat?: boolean;
  tezKategoriyalar?: TezKategoriyalar;
  currentUserId: string;
  currentUserRol: Rol;
  moveTargets?: { id: string; nomi: string }[];
  /**
   * Davr yakuni. `null` — foydalanuvchida `hisobot.korish` huquqi YO'Q,
   * ya'ni raqamlar serverdan umuman kelmagan (yashirilgan emas, berilmagan).
   */
  totals: { jamiKirim: number; jamiChiqim: number; sof: number } | null;
  /** Joriy filtr bo'yicha kategoriya kesimi — sahifaning asosiy ro'yxati. */
  kategoriyaJamlari: KategoriyaJami[];
  filters: FiltrQiymati;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  // CSV import (Faza 4.4) — faqat boshqaruvchilar uchun.
  const {
    items,
    total,
    selected,
    yangilanish,
    toggleSelect,
    toggleAll,
    bulkOptimistik,
    handleCreated,
    handleUpdated,
    handleDelete,
  } = useYozuvHolati(initialItems, initialTotal);
  const [importOpen, setImportOpen] = useState(false);
  const [yangiOchilsin, setYangiOchilsin] = useState(0);
  const { holat, setHolat, amallar } = useYozuvOynalari();

  // KO'RINISH: asosiysi — kategoriya kesimi. "Ro'yxat" (tekis lenta,
  // desktopda jadval) ikkinchi darajali, lekin saqlanadi: ommaviy
  // belgilash, sahifalash va Excel kesimi o'sha yerda.
  const korinish =
    searchParams.get("korinish") === "royxat" ? "royxat" : "kategoriya";

  function korinishAlmash(v: "kategoriya" | "royxat") {
    const p = new URLSearchParams(searchParams.toString());
    // Sahifa raqami ko'rinishga bog'liq — almashganda 1-sahifadan boshlanadi.
    p.delete("page");
    if (v === "royxat") p.set("korinish", "royxat");
    else p.delete("korinish");
    router.push(`${pathname}${p.toString() ? `?${p}` : ""}`);
  }

  // Eksport va kategoriya ichi ham EFFEKTIV davr bilan ketadi (turlar.ts).
  const effektivQuery = useMemo(
    () => effektivFiltrQuery(searchParams.toString(), filters),
    [searchParams, filters]
  );
  const exportUrl = `/api/transactions/export${effektivQuery ? `?${effektivQuery}` : ""}`;
  const manager = isManager(currentUserRol);
  // Standart davr ham ro'yxatni TORAYTIRADI, shuning uchun bo'sh natija
  // "hali yozuv yo'q" emas, "bu davrda yozuv yo'q" degani — tozalash tugmasi
  // ko'rsatiladi va u butun tarixga olib boradi.
  const filtrFaol = faolFiltrSoni(filters) > 0 || !!filters.from || !!filters.to;
  const butunTarix = `${pathname}?davr=hammasi`;
  const ozgartirsaBoladi = useMemo(
    () => (t: TransactionDTO) => ozgartirishMumkinmi(t, currentUserId, manager),
    [currentUserId, manager],
  );

  return (
    <div className="space-y-4">
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">
          Kirim va chiqimlar
        </h1>
        <div className="flex items-center gap-2">
          <YangiYozuv
            ochSignal={yangiOchilsin}
            categories={categories}
            accounts={accounts}
            standartKassa={standartKassa}
            masullar={masullar}
            sotuvchilar={masullar}
            currentUserId={currentUserId}
            sotuvchiTanlash={manager}
            tezKategoriyalar={tezKategoriyalar}
            onCreated={handleCreated}
            onQarzCreated={() => {
              toast({
                message: "Qarz yozildi — balans o'zgarmadi",
                tone: "success",
              });
              router.refresh();
            }}
          />
          <ImportExportMenu
            exportUrl={exportUrl}
            onImport={manager ? () => setImportOpen(true) : undefined}
          />
        </div>
      </div>

      {/* Davr yakuni — faqat `hisobot.korish` huquqi bo'lganda. Huquq
          yo'q bo'lsa `totals` serverdan UMUMAN kelmaydi va bu yerda hech
          nima render qilinmaydi: bo'sh karta ham, joy ham qolmaydi. */}
      {totals && (
        <SummaryBar
          jamiKirim={totals.jamiKirim}
          jamiChiqim={totals.jamiChiqim}
          sof={totals.sof}
        />
      )}

      {/* Xodimlar analitikasi havolasi — faqat `hisobot.korish` huquqi
          borlarga: oddiy sotuvchiga butun biznes reytingi ochilmaydi. */}
      {xodimlarStat && <XodimlarHavola />}

      <TransactionFilters
        categories={categories}
        xodimlar={xodimlar}
        initial={filters}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Segmented
          options={[
            { value: "kategoriya", label: "Kategoriya" },
            { value: "royxat", label: "Ro'yxat" },
          ]}
          value={korinish}
          onChange={korinishAlmash}
        />
        {korinish === "kategoriya" && (
          <span className="text-sm text-muted tnum">{total} ta yozuv</span>
        )}
      </div>

      {korinish === "kategoriya" ? (
        <KategoriyaKorinish
          kategoriyalar={kategoriyaJamlari}
          filtrQuery={effektivQuery}
          amallar={amallar}
          ozgartirsaBoladi={ozgartirsaBoladi}
          filtrFaol={filtrFaol}
          onFiltrTozalash={() => router.push(butunTarix)}
          onYangi={() => setYangiOchilsin((n) => n + 1)}
          yangilanish={yangilanish}
        />
      ) : (
        <>
          <BulkAmallar
            selected={selected}
            total={total}
            moveTargets={moveTargets}
            onOptimistik={bulkOptimistik}
          />

          <TransactionList
            items={items}
            total={total}
            page={page}
            pageSize={pageSize}
            ozgartirsaBoladi={ozgartirsaBoladi}
            filtrFaol={filtrFaol}
            amallar={amallar}
            onYangi={() => setYangiOchilsin((n) => n + 1)}
            onFiltrTozalash={() => router.push(butunTarix)}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
          />
        </>
      )}

      {/* Tafsilot / tahrirlash / o'chirish — ikkala ko'rinish uchun BITTA
          to'plam (YozuvOynalari). */}
      <YozuvOynalari
        holat={holat}
        setHolat={setHolat}
        categories={categories}
        accounts={accounts}
        sotuvchilar={masullar}
        sotuvchiTanlash={manager}
        ozgartirsaBoladi={ozgartirsaBoladi}
        onUpdated={handleUpdated}
        onDelete={handleDelete}
      />
    </div>
  );
}
