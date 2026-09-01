"use client";

import { Select } from "@/components/ui/Select";
import type { KategoriyaDTO } from "./turlar";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * ZAKAZNING ASOSIY MAYDONLARI: kategoriya, xizmat nomi, mijoz va telefon.
 *
 * Kategoriya ro'yxati KIRIM modulining kategoriyalari — CRM o'zining
 * alohida ro'yxatini yuritmaydi (bitta haqiqat manbai).
 */
export function ZakazAsosiy({
  kategoriyalar,
  categoryId,
  onCategoryId,
  nomi,
  onNomi,
  kontaktIsm,
  onKontaktIsm,
  kontaktTel,
  onKontaktTel,
}: {
  kategoriyalar: KategoriyaDTO[];
  categoryId: string;
  onCategoryId: (v: string) => void;
  nomi: string;
  onNomi: (v: string) => void;
  kontaktIsm: string;
  onKontaktIsm: (v: string) => void;
  kontaktTel: string;
  onKontaktTel: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <label className="block text-xs text-muted" htmlFor="bm-kategoriya">Kategoriya</label>
        <Select
          id="bm-kategoriya"
          value={categoryId}
          onChange={onCategoryId}
          searchable={kategoriyalar.length > 7}
          placeholder="Kategoriya yo'q"
          options={kategoriyalar.map((k) => ({ value: k.id, label: k.nomi }))}
        />
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Xizmat / zakaz nomi</span>
        <input
          autoFocus
          value={nomi}
          onChange={(e) => onNomi(e.target.value)}
          placeholder="Masalan: Panda Masha"
          className={INPUT}
          required
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Mijoz ismi</span>
          <input
            value={kontaktIsm}
            onChange={(e) => onKontaktIsm(e.target.value)}
            placeholder="Zebo"
            className={INPUT}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Telefon</span>
          <input
            value={kontaktTel}
            onChange={(e) => onKontaktTel(e.target.value)}
            placeholder="+998 90 123 45 67"
            inputMode="tel"
            className={INPUT}
          />
        </label>
      </div>
    </>
  );
}
