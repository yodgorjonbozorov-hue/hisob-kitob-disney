"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { parseSomInput } from "@/lib/format";
import type { KategoriyaDTO, SotuvchiDTO, StageDTO, XodimDTO, XodimKategoriyaDTO } from "./turlar";
import { SotuvchiTanlash } from "./SotuvchiTanlash";
import { BuyurtmaMijozMaydonlari } from "./BuyurtmaMijozMaydonlari";
import { INPUT_KLASS } from "./formaUslub";
import {
  ZakazXodimlariTanlash,
  ijroKategoriyalari,
  tanlovdanRoyxat,
  type ZakazXodimTanlov,
} from "./ZakazXodimlari";

const INPUT = INPUT_KLASS;

/**
 * Yangi buyurtma (1/2-talab): kategoriya, xizmat nomi, SOTUVCHI, mijoz,
 * telefon, narx, sana, izoh, holat.
 *
 * Kategoriya ro'yxati KIRIM modulining kategoriyalari — CRM o'zining
 * alohida ro'yxatini yuritmaydi.
 */
export function BuyurtmaModal({
  kategoriyalar,
  stages,
  xodimlar,
  xodimKategoriyalari,
  sotuvchilar,
  ozimSotuvchi,
  sotuvchiMajburiy,
  sotuvchiOzgartira,
  meId,
  bugun,
  onClose,
}: {
  kategoriyalar: KategoriyaDTO[];
  stages: StageDTO[];
  xodimlar: XodimDTO[];
  /** Xodim kategoriyalari (Diktor/Dekorator/...) — "Zakazni bajaruvchilar". */
  xodimKategoriyalari: XodimKategoriyaDTO[];
  /** Sotuvchilar (faol, sotuvchi kategoriyasi a'zolari). */
  sotuvchilar: SotuvchiDTO[];
  /** Joriy foydalanuvchining sotuvchi profili (avto-tanlash, 4-talab). */
  ozimSotuvchi: string | null;
  /** Biznes sozlamasi: sotuvchi majburiymi (6-talab). */
  sotuvchiMajburiy: boolean;
  /** Boshqa sotuvchini tanlash huquqi (5/27-talab). */
  sotuvchiOzgartira: boolean;
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
  const [stageId, setStageId] = useState(stages.find((s) => s.turi === "OPEN")?.id ?? "");
  // AVTO-TANLASH (4-talab): sotuvchi o'z accountidan kirsa o'zi tanlangan
  // holda ochiladi — har safar o'zini qidirmasin.
  const [sotuvchiId, setSotuvchiId] = useState(ozimSotuvchi ?? "");
  const [xodimTanlov, setXodimTanlov] = useState<ZakazXodimTanlov>({});
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ijrochilar = ijroKategoriyalari(xodimKategoriyalari);
  // Sotuvchi maydoni bor bo'lsa mas'ul o'sha tanlovdan chiqadi (server
  // sinxronlaydi) — ikkita "kim sotdi" maydoni ko'rsatilmaydi.
  const sotuvchiSelektorBor = sotuvchilar.length > 0;

  async function saqlash(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      setXato("Avval Kirim bo'limida kategoriya yarating");
      return;
    }
    // Frontend tekshiruvi faqat qulaylik uchun — server ham majburlaydi.
    if (sotuvchiMajburiy && !sotuvchiId) {
      setXato("Buyurtmani olgan sotuvchini tanlang");
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
        summa: summa ? parseSomInput(summa) : 0,
        kontaktIsm: kontaktIsm || null,
        kontaktTel: kontaktTel || null,
        sana: sana || null,
        izoh: izoh || null,
        masulId,
        stageId: stageId || null,
        sotuvchiId: sotuvchiId || null,
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
        <h2 className="font-semibold text-fg text-lg">Yangi buyurtma</h2>

        <div className="space-y-1">
          <label className="block text-xs text-muted" htmlFor="bm-kategoriya">Kategoriya</label>
          <Select
            id="bm-kategoriya"
            value={categoryId}
            onChange={setCategoryId}
            searchable={kategoriyalar.length > 7}
            placeholder="Kategoriya yo'q"
            options={kategoriyalar.map((k) => ({ value: k.id, label: k.nomi }))}
          />
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-muted">Xizmat / buyurtma nomi</span>
          <input
            autoFocus
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            placeholder="Masalan: Onajon Dekor"
            className={INPUT}
            required
          />
        </label>

        <SotuvchiTanlash
          id="bm-sotuvchi"
          sotuvchilar={sotuvchilar}
          value={sotuvchiId}
          onChange={setSotuvchiId}
          majburiy={sotuvchiMajburiy}
          ozgartira={sotuvchiOzgartira}
        />

        <BuyurtmaMijozMaydonlari
          kontaktIsm={kontaktIsm}
          setKontaktIsm={setKontaktIsm}
          kontaktTel={kontaktTel}
          setKontaktTel={setKontaktTel}
          summa={summa}
          setSumma={setSumma}
          sana={sana}
          setSana={setSana}
        />

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
          <div className="space-y-1">
            <label className="block text-xs text-muted" htmlFor="bm-holat">Holat</label>
            <Select
              id="bm-holat"
              value={stageId}
              onChange={setStageId}
              options={stages.map((s) => ({ value: s.id, label: s.nomi }))}
            />
          </div>
        </div>

        <ZakazXodimlariTanlash
          kategoriyalar={ijrochilar}
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
