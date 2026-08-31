"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseSomInput } from "@/lib/format";
import type { KategoriyaDTO, StageDTO, XodimDTO, XodimKategoriyaDTO } from "./turlar";
import {
  ZakazXodimlariTanlash,
  boshlangichTanlov,
  tanlovdanRoyxat,
  type ZakazXodimTanlov,
} from "./ZakazXodimlari";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * Yangi buyurtma (2-talab): kategoriya, xizmat nomi, mijoz, telefon, narx,
 * sana, izoh, mas'ul xodim, holat.
 *
 * Kategoriya ro'yxati KIRIM modulining kategoriyalari — CRM o'zining
 * alohida ro'yxatini yuritmaydi.
 */
export function BuyurtmaModal({
  kategoriyalar,
  stages,
  xodimlar,
  xodimKategoriyalari,
  meId,
  bugun,
  onClose,
}: {
  kategoriyalar: KategoriyaDTO[];
  stages: StageDTO[];
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
  const [stageId, setStageId] = useState(stages.find((s) => s.turi === "OPEN")?.id ?? "");
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

  async function saqlash(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      setXato("Avval Kirim bo'limida kategoriya yarating");
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

        <label className="block space-y-1">
          <span className="text-xs text-muted">Kategoriya</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={INPUT} required>
            {kategoriyalar.length === 0 && <option value="">Kategoriya yo&apos;q</option>}
            {kategoriyalar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nomi}
              </option>
            ))}
          </select>
        </label>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-muted">Mijoz ismi</span>
            <input value={kontaktIsm} onChange={(e) => setKontaktIsm(e.target.value)} placeholder="Ali" className={INPUT} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted">Telefon</span>
            <input
              value={kontaktTel}
              onChange={(e) => setKontaktTel(e.target.value)}
              placeholder="+998 90 123 45 67"
              inputMode="tel"
              className={INPUT}
            />
          </label>
        </div>

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
            <span className="text-xs text-muted">Buyurtma sanasi</span>
            <input type="date" value={sana} onChange={(e) => setSana(e.target.value)} className={INPUT} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Sotuvchi kategoriya-selektori bo'lsa mas'ul o'sha yerdan chiqadi. */}
          {!sotuvchiSelektorBor && (
            <label className="block space-y-1">
              <span className="text-xs text-muted">Mas&apos;ul xodim</span>
              <select value={masulId} onChange={(e) => setMasulId(e.target.value)} className={INPUT}>
                {xodimlar.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.ism}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-xs text-muted">Holat</span>
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={INPUT}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nomi}
                </option>
              ))}
            </select>
          </label>
        </div>

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
