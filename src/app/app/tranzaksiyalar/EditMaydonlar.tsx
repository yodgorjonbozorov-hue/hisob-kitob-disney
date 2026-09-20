"use client";

import { Select } from "@/components/ui/Select";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { formatSom, parseSomInput } from "@/lib/format";
import { TOLOV_TURLARI, TOLOV_NOMI, TOLOV_BELGI, type TolovTuri } from "@/lib/validation/transaction";
import { kassaTavsifi } from "./turlar";
import type { AccountOption, CategoryOption, XodimOption } from "./turlar";

/**
 * TAHRIR FORMASINING MAYDONLARI.
 *
 * Alohida faylda: `EditModal` holat va saqlashni yuritadi, bu yerda esa
 * faqat ko'rinish — ikkalasi ham 250 satr chegarasidan oshmasin (CLAUDE.md).
 *
 * Auditdagi K-2: tahrir formasida KASSA va SOTUVCHI maydonlari umuman yo'q
 * edi, shuning uchun xato kassaga tushgan pulni UI orqali to'g'rilab
 * bo'lmasdi — yagona yo'l o'chirib qayta yaratish edi, bu esa audit izini
 * buzardi. Maydonlar YALANG'OCH ham edi (label yo'q).
 */
export interface EditQiymat {
  turi: "kirim" | "chiqim";
  tolovTuri: TolovTuri;
  categoryId: string;
  summaText: string;
  sana: string;
  izoh: string;
  accountId: string;
  sotuvchiId: string;
}

export function EditMaydonlar({
  q,
  set,
  kgYozuvi,
  kgMaydon,
  filteredCategories,
  accounts,
  sotuvchilar,
  sotuvchiTanlash,
  kassaKerak,
  onTuri,
  onTolov,
  disabled,
}: {
  q: EditQiymat;
  set: (patch: Partial<EditQiymat>) => void;
  kgYozuvi: boolean;
  /** Kg rejimidagi maydonlar (miqdor va 1 kg narxi) — summa o'rniga. */
  kgMaydon: React.ReactNode;
  filteredCategories: CategoryOption[];
  accounts: AccountOption[];
  sotuvchilar: XodimOption[];
  sotuvchiTanlash: boolean;
  /** Qarz yozuvida pul kassaga tushmagan — kassa maydoni ko'rsatilmaydi. */
  kassaKerak: boolean;
  onTuri: (t: "kirim" | "chiqim") => void;
  onTolov: (t: TolovTuri) => void;
  disabled: boolean;
}) {
  const sotuvchiKorinadi = q.turi === "kirim" && sotuvchiTanlash && sotuvchilar.length > 0;

  return (
    <div className="space-y-3">
      {/* Kg savdosida kirim/chiqim tanlovi YO'Q: sotuv har doim kirim. */}
      {!kgYozuvi && (
        <div>
          <span className={LABEL_CLASS}>Yozuv turi</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onTuri("kirim")}
              className={`flex-1 py-1.5 rounded-lg text-sm ${q.turi === "kirim" ? "bg-income text-white" : "bg-income-soft text-income-fg"}`}
            >
              Kirim
            </button>
            <button
              type="button"
              onClick={() => onTuri("chiqim")}
              className={`flex-1 py-1.5 rounded-lg text-sm ${q.turi === "chiqim" ? "bg-expense text-white" : "bg-expense-soft text-expense-fg"}`}
            >
              Chiqim
            </button>
          </div>
        </div>
      )}

      <div>
        <span className={LABEL_CLASS}>To&apos;lov turi</span>
        <div className="grid grid-cols-3 gap-2">
          {TOLOV_TURLARI.filter((t) => t !== "qarz" || q.turi === "kirim").map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTolov(t)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                q.tolovTuri === t
                  ? "border-brand bg-brand-wash text-brand font-medium"
                  : "border-line bg-surface-2 text-fg hover:border-brand"
              }`}
            >
              {TOLOV_BELGI[t]} {TOLOV_NOMI[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="edit-kategoriya">
          Kategoriya
        </label>
        <Select
          id="edit-kategoriya"
          value={q.categoryId}
          disabled={disabled}
          onChange={(v) => set({ categoryId: v })}
          searchable={filteredCategories.length > 7}
          options={filteredCategories.map((c) => ({ value: c.id, label: c.nomi }))}
        />
      </div>

      {/* KASSA — xato kassaga tushgan yozuvni shu yerdan ko'chirish mumkin.
          Qoldiq ko'rsatilmaydi: u "kassa.jami" huquqiga bog'liq maxfiy
          ma'lumot (tests/kassa-maxfiylik.test.ts). */}
      {kassaKerak && accounts.length > 0 && (
        <div>
          <label className={LABEL_CLASS} htmlFor="edit-kassa">
            Kassa <span className="text-expense">*</span>
          </label>
          <Select
            id="edit-kassa"
            value={q.accountId}
            disabled={disabled}
            onChange={(v) => set({ accountId: v })}
            searchable={accounts.length > 7}
            options={accounts.map((a) => ({
              value: a.id,
              label: a.nomi,
              tavsif: kassaTavsifi(a),
            }))}
          />
        </div>
      )}

      {sotuvchiKorinadi && (
        <div>
          <label className={LABEL_CLASS} htmlFor="edit-sotuvchi">
            Sotuvchi / Xodim
          </label>
          <Select
            id="edit-sotuvchi"
            value={q.sotuvchiId}
            disabled={disabled}
            onChange={(v) => set({ sotuvchiId: v })}
            searchable={sotuvchilar.length > 7}
            options={sotuvchilar.map((x) => ({ value: x.id, label: x.ism }))}
          />
        </div>
      )}

      {kgYozuvi ? (
        kgMaydon
      ) : (
        <div>
          <label className={LABEL_CLASS} htmlFor="edit-summa">
            Summa
          </label>
          <input
            id="edit-summa"
            type="text"
            inputMode="numeric"
            value={q.summaText}
            disabled={disabled}
            onChange={(e) => set({ summaText: formatSom(parseSomInput(e.target.value)) })}
            className={`${INPUT_CLASS} tnum`}
          />
        </div>
      )}

      <div>
        <label className={LABEL_CLASS} htmlFor="edit-sana">
          Sana
        </label>
        <input
          id="edit-sana"
          type="date"
          value={q.sana}
          disabled={disabled}
          onChange={(e) => set({ sana: e.target.value })}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="edit-izoh">
          Izoh (ixtiyoriy)
        </label>
        <input
          id="edit-izoh"
          type="text"
          value={q.izoh}
          disabled={disabled}
          onChange={(e) => set({ izoh: e.target.value })}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  );
}
