"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import type { BuyurtmaDTO, XodimDTO } from "./turlar";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * DIREKTOR TUZATISHI — zakaz nomi, mijozi, sanasi va mas'ul xodimi.
 *
 * ═══ NEGA ALOHIDA BLOK ═══
 * `BuyurtmaTahrir` PULGA tegadigan maydonlarni (kategoriya, narx, to'lov)
 * boshqaradi va moliyaga o'tgan zakazda umuman ko'rsatilmaydi. Bu yerdagi
 * maydonlar esa pulga tegmaydi: ular kirim yozilgan zakazda ham tuzatilishi
 * kerak — mijoz ismi xato tushgani "endi hech qachon to'g'rilanmaydi"
 * degani emas.
 *
 * ═══ NEGA FAQAT DIREKTORGA KO'RSATILADI ═══
 * Bular tuzatish amallari: mas'ulni almashtirish xodim statistikasini,
 * sanani surish esa doskadagi o'rnini o'zgartiradi. API bu maydonlarni
 * ilgari ham CRM'ga kira olgan har kimga ochiq qoldirgan (zakazni
 * yaratgan xodim o'z zakazini to'g'rilaydi) — bu xatti-harakat ATAYLAB
 * o'zgartirilmadi, aks holda mavjud kundalik ish buzilardi. Bu yerda faqat
 * yig'ma "tuzatish paneli" direktorga ko'rsatiladi.
 */
export function ZakazDirektorTahriri({
  b,
  xodimlar,
  onSaqlandi,
}: {
  b: BuyurtmaDTO;
  /** Shu biznesning faol xodimlari — mas'ulni almashtirish uchun. */
  xodimlar: XodimDTO[];
  onSaqlandi: () => void;
}) {
  const [nomi, setNomi] = useState(b.nomi);
  const [kontaktIsm, setKontaktIsm] = useState(b.kontakt ?? "");
  const [kontaktTel, setKontaktTel] = useState(b.tel ?? "");
  const [sana, setSana] = useState(b.sana ?? "");
  const [masulId, setMasulId] = useState(b.masulId);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const ozgardi =
    nomi.trim() !== b.nomi ||
    kontaktIsm.trim() !== (b.kontakt ?? "") ||
    kontaktTel.trim() !== (b.tel ?? "") ||
    sana !== (b.sana ?? "") ||
    masulId !== b.masulId;

  async function saqlash() {
    if (!nomi.trim()) {
      setXato("Zakaz nomi bo'sh bo'lmasin");
      return;
    }
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomi: nomi.trim(),
        // Mijoz maydonlari FAQAT o'zgargan bo'lsa yuboriladi: aks holda
        // har saqlashda mijoz kartochkasi keraksiz yangilanardi.
        ...(kontaktIsm.trim() !== (b.kontakt ?? "") ? { kontaktIsm: kontaktIsm.trim() } : {}),
        ...(kontaktTel.trim() !== (b.tel ?? "") ? { kontaktTel: kontaktTel.trim() } : {}),
        ...(sana !== (b.sana ?? "") ? { sana: sana || null } : {}),
        ...(masulId !== b.masulId ? { masulId } : {}),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Saqlanmadi");
      return;
    }
    onSaqlandi();
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2/30 p-3 space-y-2">
      <p className="text-2xs uppercase tracking-wide text-faint">
        Direktor tuzatishi — nom, mijoz, sana, mas&apos;ul
      </p>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Zakaz nomi</span>
        <input value={nomi} onChange={(e) => setNomi(e.target.value)} maxLength={200} className={INPUT} />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Mijoz</span>
          <input
            value={kontaktIsm}
            onChange={(e) => setKontaktIsm(e.target.value)}
            maxLength={100}
            placeholder="Mijoz ismi"
            className={INPUT}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Telefon</span>
          <input
            value={kontaktTel}
            onChange={(e) => setKontaktTel(e.target.value)}
            maxLength={30}
            inputMode="tel"
            placeholder="+998..."
            className={INPUT}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Zakaz sanasi</span>
          <input type="date" value={sana} onChange={(e) => setSana(e.target.value)} className={INPUT} />
        </label>
        <div className="space-y-1">
          <label className="block text-xs text-muted" htmlFor="zd-masul">
            Mas&apos;ul xodim
          </label>
          <Select
            id="zd-masul"
            value={masulId}
            onChange={setMasulId}
            searchable={xodimlar.length > 7}
            options={xodimlar.map((x) => ({ value: x.id, label: x.ism }))}
          />
        </div>
      </div>

      {xato && <p className="text-expense text-sm">{xato}</p>}
      <button
        onClick={saqlash}
        disabled={loading || !ozgardi}
        className="w-full rounded-lg border border-line text-sm font-medium py-2 text-brand disabled:opacity-40"
      >
        {loading ? "Saqlanmoqda..." : "Saqlash"}
      </button>
    </div>
  );
}
