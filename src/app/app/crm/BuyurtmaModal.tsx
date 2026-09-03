"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { parseSomInput } from "@/lib/format";
import type { KategoriyaDTO, SotuvchiDTO, XodimDTO, XodimKategoriyaDTO } from "./turlar";
import { SotuvchiTanlash } from "./SotuvchiTanlash";
import {
  ZakazJamoasiTanlash,
  ijroKategoriyalari,
  tanlovdanRoyxat,
  type ZakazXodimTanlov,
} from "./ZakazJamoasi";
import {
  TolovMaydonlari,
  tolanganHisobla,
  type PulKanali,
  type TolovTanlov,
} from "./TolovMaydonlari";
import { ZakazAsosiy } from "./ZakazAsosiy";
import { ZakazNarxSana } from "./ZakazNarxSana";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/** Forma bo'limi sarlavhasi — "SOTUVCHI", "ZAKAZ JAMOASI". */
function Bolim({ nomi }: { nomi: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-2xs uppercase tracking-wide text-faint">{nomi}</span>
      <span className="flex-1 border-t border-line" aria-hidden="true" />
    </div>
  );
}

/**
 * YANGI ZAKAZ: xizmat nomi, mijoz, telefon, narx, ZAKAZ SANASI (majburiy —
 * doskadagi o'rin shundan hisoblanadi), to'lov, SOTUVCHI (kim oldi) va
 * ZAKAZ JAMOASI (kim bajaradi). Sotuvchi va jamoa ATAYLAB ikki bo'lim:
 * sotuvchi — sotuv statistikasi (yutilsa +1 zakaz, +summa), jamoa —
 * qatnashuv statistikasi (bajarildi/bekor/baho). Jamoa maydonlari
 * ixtiyoriy va biznes lavozimlaridan dinamik quriladi (7-talab).
 */
export function BuyurtmaModal({
  kategoriyalar,
  xodimlar,
  xodimKategoriyalari,
  sotuvchilar,
  sotuvchiMajburiy,
  sotuvchiOzgartira,
  meId,
  bugun,
  onClose,
}: {
  kategoriyalar: KategoriyaDTO[];
  xodimlar: XodimDTO[];
  /** Xodim lavozimlari (Animator/Shofyor/...) — "Zakaz jamoasi". */
  xodimKategoriyalari: XodimKategoriyaDTO[];
  /** Sotuvchilar (faol, sotuvchi lavozimi a'zolari). */
  sotuvchilar: SotuvchiDTO[];
  /** Biznes sozlamasi: sotuvchi majburiymi. */
  sotuvchiMajburiy: boolean;
  /** `crm.sotuvchi` huquqi — yo'q bo'lsa maydon qulflanadi. */
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
  const [tolovTanlov, setTolovTanlov] = useState<TolovTanlov>("toliq");
  const [tolangan, setTolangan] = useState("");
  const [tolovTuri, setTolovTuri] = useState<PulKanali>("naqd");
  // AVTO-TANLASH YO'Q (ataylab): Disney Navoiy sotuv bo'limida BITTA umumiy
  // kompyuter ishlatiladi, ya'ni tizimga kirgan hisob zakazni kim sotganini
  // BILDIRMAYDI. Default "Tanlanmagan" — sotuvchini har safar odam tanlaydi.
  // Kirgan foydalanuvchi faqat createdBy/audit uchun (`Activity.userId`).
  const [sotuvchiId, setSotuvchiId] = useState("");
  const [jamoa, setJamoa] = useState<ZakazXodimTanlov>({});
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sotuvchi maydoni bor bo'lsa mas'ul o'sha tanlovdan chiqadi (server
  // sinxronlaydi); ESKI "Mas'ul xodim" faqat sotuvchi lavozimsiz biznesda qoladi.
  const sotuvchiSelektorBor = sotuvchilar.length > 0;
  const ijrochilar = ijroKategoriyalari(xodimKategoriyalari);

  const narx = summa ? parseSomInput(summa) : 0;
  // TO'LANGAN SUMMA tanlovdan chiqadi: to'liq — butun narx, qarzga — 0,
  // qisman — kiritilgan raqam. Server ham AYNI shu ikkovidan hisoblaydi.
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
    // Frontend tekshiruvi qulaylik uchun — server ham majburlaydi.
    if (sotuvchiMajburiy && !sotuvchiId) {
      setXato("Buyurtmani olgan sotuvchini tanlang");
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
        sotuvchiId: sotuvchiId || null,
        xodimlar: tanlovdanRoyxat(jamoa),
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

        <ZakazNarxSana summa={summa} onSumma={setSumma} sana={sana} onSana={setSana} bugun={bugun} />

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

        <Bolim nomi="Sotuvchi" />
        {sotuvchiSelektorBor ? (
          <SotuvchiTanlash
            id="bm-sotuvchi"
            sotuvchilar={sotuvchilar}
            value={sotuvchiId}
            onChange={setSotuvchiId}
            majburiy={sotuvchiMajburiy}
            ozgartira={sotuvchiOzgartira}
          />
        ) : (
          <div className="space-y-1">
            <label className="block text-xs text-muted" htmlFor="bm-masul">Mas&apos;ul xodim</label>
            <Select
              id="bm-masul"
              value={masulId}
              onChange={setMasulId}
              searchable={xodimlar.length > 7}
              options={xodimlar.map((x) => ({ value: x.id, label: x.ism }))}
            />
            <p className="text-2xs text-faint">
              Sotuvchi lavozimi sozlanmagan — Xodimlar → Lavozimlar bo&apos;limida &quot;Sotuvchi&quot;
              yarating, shunda bu yerda sotuvchi tanlanadi.
            </p>
          </div>
        )}

        {ijrochilar.length > 0 && (
          <>
            <Bolim nomi="Zakaz jamoasi" />
            <ZakazJamoasiTanlash kategoriyalar={ijrochilar} tanlov={jamoa} onChange={setJamoa} />
          </>
        )}

        <label className="block space-y-1">
          <span className="text-xs text-muted">Qo&apos;shimcha shartlar</span>
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
