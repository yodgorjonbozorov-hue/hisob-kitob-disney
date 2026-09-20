"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { SlidersHorizontal, Search, X } from "lucide-react";
import { parseSomInput } from "@/lib/format";
import { TOSHKENT_OFFSET_MS, buOyDavri } from "@/lib/date";
import { FiltrSheet } from "./FiltrSheet";
import { BOSH_FILTR, faolFiltrSoni, type CategoryOption, type FiltrQiymati, type XodimOption } from "./turlar";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
/** Toshkentga siljitilgan Date'dan "YYYY-MM-DD" (UTC komponentlari bo'yicha). */
function ymd(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Sana preseti → { from, to } — ASIA/TASHKENT kalendari bo'yicha.
 *
 * Ilgari brauzerning mahalliy vaqti ishlatilardi, server esa Toshkent kuni
 * bilan hisoblaydi (`todayTashkentDateOnlyString`). Boshqa mintaqadagi
 * brauzerda "Bu oy" chipi standart davr bilan bir kunga farq qilib, chip
 * tanlanmagan ko'rinardi.
 */
function presetRange(key: string): { from: string; to: string } {
  const now = new Date(Date.now() + TOSHKENT_OFFSET_MS);
  const today = ymd(now);
  if (key === "bugun") return { from: today, to: today };
  if (key === "hafta") {
    const day = (now.getUTCDay() + 6) % 7; // Dushanba = 0
    const start = new Date(now.getTime() - day * 86_400_000);
    return { from: ymd(start), to: today };
  }
  if (key === "oy") return buOyDavri();
  if (key === "otganOy") {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return { from: ymd(first), to: ymd(last) };
  }
  if (key === "chorak") {
    const q = Math.floor(now.getUTCMonth() / 3);
    return { from: `${now.getUTCFullYear()}-${pad(q * 3 + 1)}-01`, to: today };
  }
  if (key === "yil") return { from: `${now.getUTCFullYear()}-01-01`, to: today };
  return { from: "", to: "" };
}

/**
 * Presetlar. `mobil: true` bo'lganlari 375px da ham ko'rinadi — qolgani
 * "Filtrlar" varag'idagi sana oralig'i orqali beriladi (telefonda oltita
 * tugmani bitta qatorga sig'dirib bo'lmaydi).
 */
const PRESETS = [
  { key: "bugun", label: "Bugun", mobil: true },
  { key: "hafta", label: "Bu hafta", mobil: true },
  { key: "oy", label: "Bu oy", mobil: true },
  { key: "otganOy", label: "O'tgan oy", mobil: false },
  { key: "chorak", label: "Chorak", mobil: false },
  { key: "yil", label: "Yil", mobil: false },
  // Sahifa standart "Bu oy" bilan ochiladi (audit K-7) — butun tarixni
  // ko'rish endi ATAYLAB tanlanadi va URL'da (`davr=hammasi`) qoladi.
  { key: "hammasi", label: "Butun tarix", mobil: false },
];

/**
 * FILTRLAR — holat URL'da (`?from=&turi=&tolov=...`).
 *
 * URL'da bo'lgani uchun: server filtrlangan sahifani o'zi render qiladi,
 * havola nusxalab yuborilsa boshqa odam AYNI ro'yxatni ko'radi va brauzer
 * "orqaga" tugmasi kutilgandek ishlaydi. Eksport ham shu parametrlarni
 * oladi — ekranda ko'ringan to'plam yuklab olinadi.
 */
export function TransactionFilters({
  categories,
  xodimlar,
  initial,
}: {
  categories: CategoryOption[];
  xodimlar: XodimOption[];
  initial: FiltrQiymati;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [values, setValues] = useState(initial);
  const [sheetOchiq, setSheetOchiq] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => setValues(initial), [initial]);

  function applyFilters(next: FiltrQiymati) {
    const params = new URLSearchParams();
    // Aniq oraliq berilgan bo'lsa "butun tarix" bayrog'i o'z kuchini
    // yo'qotadi — ikkovi bir vaqtda URL'da turmasin.
    if (next.davr === "hammasi" && !next.from && !next.to) params.set("davr", "hammasi");
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.turi) params.set("turi", next.turi);
    if (next.tolov) params.set("tolov", next.tolov);
    if (next.categoryId) params.set("categoryId", next.categoryId);
    if (next.xodimId) params.set("xodimId", next.xodimId);
    if (next.q) params.set("q", next.q);
    if (next.minSumma) params.set("minSumma", String(parseSomInput(next.minSumma)));
    if (next.maxSumma) params.set("maxSumma", String(parseSomInput(next.maxSumma)));
    // `page` ATAYLAB tashlanadi: filtr o'zgarganda 7-sahifada qolish —
    // ko'pincha bo'sh ro'yxat degani.
    router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
  }

  function update(patch: Partial<FiltrQiymati>, immediate = true) {
    const next = { ...values, ...patch };
    setValues(next);
    if (immediate) applyFilters(next);
  }

  // Qidiruv uchun debounce — har harfda so'rov ketmasin.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const t = setTimeout(() => applyFilters(values), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.q]);

  const activeCount = faolFiltrSoni(values);

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-line p-3 sm:p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 min-w-0 flex-wrap gap-2">
          {PRESETS.map((p) => {
            const hammasi = p.key === "hammasi";
            const r = presetRange(p.key);
            const active = hammasi
              ? values.davr === "hammasi" && !values.from && !values.to
              : values.davr !== "hammasi" && values.from === r.from && values.to === r.to;
            return (
              <button
                key={p.key}
                onClick={() =>
                  update(
                    hammasi
                      ? { from: "", to: "", davr: "hammasi" }
                      : { ...presetRange(p.key), davr: "" }
                  )
                }
                className={`px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm min-h-[36px] border transition ${
                  p.mobil ? "" : "hidden sm:inline-flex"
                } ${active ? "bg-brand text-brand-fg border-transparent" : "bg-surface-2 text-fg border-line"}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setSheetOchiq(true)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[40px] rounded-lg border text-xs sm:text-sm font-medium transition ${
            activeCount > 0
              ? "border-brand bg-brand-wash text-brand"
              : "border-line bg-surface-2 text-fg hover:border-brand"
          }`}
          aria-label="Filtrlar"
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          <span>Filter</span>
          {activeCount > 0 && <span className="tnum">({activeCount})</span>}
        </button>
      </div>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={values.q}
          onChange={(e) => update({ q: e.target.value }, false)}
          placeholder="Izoh yoki kategoriya bo'yicha qidirish..."
          aria-label="Yozuvlar orasidan qidirish"
          className="w-full rounded-lg border border-line bg-surface text-fg pl-9 pr-3 py-2.5 text-base min-h-[44px]
            placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
        />
      </div>

      {activeCount > 0 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{activeCount} ta filtr faol</span>
          <button
            onClick={() => {
              // "Tozalash" — standart davrga (Bu oy) qaytish: URL'siz holat
              // ayni shu davrni bildiradi (app/tranzaksiyalar/page.tsx).
              setValues({ ...BOSH_FILTR, ...presetRange("oy") });
              router.push(pathname);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-expense hover:underline min-h-[32px]"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Hammasini tozalash
          </button>
        </div>
      )}

      {sheetOchiq && (
        <FiltrSheet
          qiymat={values}
          kategoriyalar={categories}
          xodimlar={xodimlar}
          onClose={() => setSheetOchiq(false)}
          onApply={(f) => {
            setSheetOchiq(false);
            setValues(f);
            applyFilters(f);
          }}
        />
      )}
    </div>
  );
}
