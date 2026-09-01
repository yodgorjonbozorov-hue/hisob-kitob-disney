"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { parseSomInput } from "@/lib/format";
import type { KategoriyaDTO, XodimDTO, XodimKategoriyaDTO } from "./turlar";
import {
  ZakazXodimlariTanlash,
  boshlangichTanlov,
  tanlovdanRoyxat,
  type ZakazXodimTanlov,
} from "./ZakazXodimlari";
import {
  TolovMaydonlari,
  tolanganHisobla,
  type PulKanali,
  type TolovTanlov,
} from "./TolovMaydonlari";
import { ZakazAsosiy } from "./ZakazAsosiy";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * YANGI ZAKAZ (6-talab): kategoriya, xizmat nomi, mijoz, telefon, sotuvchi,
 * ZAKAZ SANASI (majburiy), narx, to'lov turi, izoh.
 *
 * ZAKAZ SANASI majburiy, chunki doskadagi o'rin aynan shundan hisoblanadi:
 * sana bugun bo'lsa zakaz darhol "Bugungi zakazlar"da, kelajakda bo'lsa
 * "Kutilayotgan zakazlar"da ko'rinadi. Holat tanlovi ATAYLAB olib
 * tashlandi — yangi zakaz har doim kutilayotganlarda tug'iladi.
 *
 * Kategoriya ro'yxati KIRIM modulining kategoriyalari — CRM o'zining
 * alohida ro'yxatini yuritmaydi.
 */
export function BuyurtmaModal({
  kategoriyalar,
  xodimlar,
  xodimKategoriyalari,
  meId,
  bugun,
  onClose,
}: {
  kategoriyalar: KategoriyaDTO[];
  xodimlar: XodimDTO[];
  /** Xodim kategoriyalari (Sotuvchi/Diktor/...) — "Zakazdagi xodimlar" bo'limi. */
  xodimKategoriyalari: XodimKategoriyaDTO[];
  meId: string;
  /** Bugungi sana "YYYY-MM-DD" (server tomondan — brauzer vaqt mintaqasi emas). */
  bugun: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(kategoriyalar[0]?.id ?? "");
  const [nomi, setNomi] = useState("");
  const [kontaktIsm, setKontaktIsm] = useState("");
  const [kontaktTel, setKontaktTel] = useState("");
  const [summa, setSumma] = useState("");
  const [sana, setSana] = useState(bugun);
  const [izoh, setIzoh] = useState("");
  const [masulId, setMasulId] = useState(meId);
  const [tolovTanlov, setTolovTanlov] = useState<TolovTanlov>("toliq");
  const [tolangan, setTolangan] = useState("");
  const [tolovTuri, setTolovTuri] = useState<PulKanali>("naqd");
  // Sotuvchi turidagi kategoriyada joriy foydalanuvchi a'zo bo'lsa — o'zi
  // oldindan tanlanadi (3-talab: o'zini har safar qidirmasin).
  const [xodimTanlov, setXodimTanlov] = useState<ZakazXodimTanlov>(() =>
    boshlangichTanlov(xodimKategoriyalari, meId)
  );
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sotuvchi kategoriya-selektori bor bo'lsa mas'ul o'sha tanlovdan chiqadi
  // (server sinxronlaydi) — ikkita "kim sotdi" maydoni ko'rsatilmaydi.
  const sotuvchiSelektorBor = xodimKategoriyalari.some(
    (k) => k.turi === "sotuvchi" && k.azolar.length > 0
  );

  const narx = summa ? parseSomInput(summa) : 0;
  // TO'LANGAN SUMMA tanlovdan chiqadi: to'liq — butun narx, qarzga — 0,
  // qisman — kiritilgan raqam. To'lov holati serverda ham AYNI shu
  // ikkovidan (narx va to'langan) hisoblanadi.
  const tolanganSumma = tolanganHisobla(tolovTanlov, narx, tolangan ? parseSomInput(tolangan) : 0);

  async function saqlash(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      setXato("Avval Kirim bo'limida kategoriya yarating");
      return;
    }
    if (!sana) {
      setXato("Zakaz sanasi kiritilsin");
      return;
    }
    if (tolanganSumma > narx) {
      setXato("To'langan summa zakaz narxidan ko'p bo'lmasligi kerak");
      return;
    }
    setLoading(true);
    setXato(null);
    const res = await fetch("/api/crm/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomi,
        categoryId,
        summa: narx,
        tolangan: tolanganSumma,
        tolovTuri: tolovTanlov === "qarz" ? "qarz" : tolovTuri,
        kontaktIsm: kontaktIsm || null,
        kontaktTel: kontaktTel || null,
        sana,
        izoh: izoh || null,
        masulId,
        xodimlar: tanlovdanRoyxat(xodimTanlov),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Xatolik yuz berdi");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={saqlash}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-line p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="font-semibold text-fg text-lg">Yangi zakaz</h2>

        <ZakazAsosiy
          kategoriyalar={kategoriyalar}
          categoryId={categoryId}
          onCategoryId={setCategoryId}
          nomi={nomi}
          onNomi={setNomi}
          kontaktIsm={kontaktIsm}
          onKontaktIsm={setKontaktIsm}
          kontaktTel={kontaktTel}
          onKontaktTel={setKontaktTel}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-muted">Narx (so&apos;m)</span>
            <input
              value={summa}
              onChange={(e) => setSumma(e.target.value)}
              placeholder="500000"
              inputMode="numeric"
              className={INPUT}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted">
              Zakaz sanasi <span className="text-expense">*</span>
            </span>
            <input
              type="date"
              value={sana}
              onChange={(e) => setSana(e.target.value)}
              className={INPUT}
              required
            />
            <span className="block text-2xs text-faint">
              {sana === bugun ? "Bugungi zakazlarga tushadi" : "Kutilayotgan zakazlarga tushadi"}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Sotuvchi kategoriya-selektori bo'lsa mas'ul o'sha yerdan chiqadi. */}
          {!sotuvchiSelektorBor && (
            <div className="space-y-1">
              <label className="block text-xs text-muted" htmlFor="bm-masul">Mas&apos;ul xodim</label>
              <Select
                id="bm-masul"
                value={masulId}
                onChange={setMasulId}
                searchable={xodimlar.length > 7}
                options={xodimlar.map((x) => ({ value: x.id, label: x.ism }))}
              />
            </div>
          )}
        </div>

        <TolovMaydonlari
          tanlov={tolovTanlov}
          onTanlov={setTolovTanlov}
          qisman={tolangan}
          onQisman={setTolangan}
          kanal={tolovTuri}
          onKanal={setTolovTuri}
          narx={narx}
          tolangan={tolanganSumma}
        />

        <ZakazXodimlariTanlash
          kategoriyalar={xodimKategoriyalari}
          tanlov={xodimTanlov}
          onChange={setXodimTanlov}
        />

        <label className="block space-y-1">
          <span className="text-xs text-muted">Izoh</span>
          <textarea
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            rows={2}
            placeholder="Qo'shimcha shartlar..."
            className={INPUT}
          />
        </label>

        {xato && <p className="text-expense text-sm">{xato}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-line text-sm text-muted">
            Bekor
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-income text-white text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </form>
    </div>
  );
}
