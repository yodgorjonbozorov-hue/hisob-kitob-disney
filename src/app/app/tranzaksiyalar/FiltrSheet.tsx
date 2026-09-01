"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { formatSom, parseSomInput } from "@/lib/format";
import { TOLOV_GURUHLARI, TOLOV_GURUHI_BELGI, TOLOV_GURUHI_NOMI } from "@/lib/tolovBolimi";
import type { CategoryOption, FiltrQiymati, XodimOption } from "./turlar";
import { BOSH_FILTR } from "./turlar";

/**
 * BARCHA FILTRLAR — bitta varaqda (mobil'da pastdan, desktopda dialog).
 *
 * Nega varaq: telefonda oltita tanlov maydonini bitta qatorga tiqish
 * mumkin emas — ular yo kesiladi, yo sahifani yon tomonga siljitadi.
 * Varaqda esa har maydon to'liq kenglikda va barmoq o'lchamida turadi.
 *
 * Tanlovlar DARHOL qo'llanmaydi: foydalanuvchi hammasini belgilab, keyin
 * "Natijalarni ko'rsatish" ni bosadi — aks holda har bosishda sahifa qayta
 * yuklanib, keyingi maydonni tanlashga ulgurmasdi.
 */
export function FiltrSheet({
  qiymat,
  kategoriyalar,
  xodimlar,
  onClose,
  onApply,
}: {
  qiymat: FiltrQiymati;
  kategoriyalar: CategoryOption[];
  /** Bo'sh bo'lsa "Kim kiritdi" maydoni chiqmaydi (xodim baribir faqat o'zinikini ko'radi). */
  xodimlar: XodimOption[];
  onClose: () => void;
  onApply: (f: FiltrQiymati) => void;
}) {
  const [f, setF] = useState<FiltrQiymati>(qiymat);
  const set = (patch: Partial<FiltrQiymati>) => setF((p) => ({ ...p, ...patch }));

  // Turi tanlansa kategoriya ro'yxati ham shu turga qisqaradi.
  const korinadiganKategoriyalar = f.turi
    ? kategoriyalar.filter((c) => c.turi === f.turi)
    : kategoriyalar;

  const MAYDON =
    "w-full rounded-lg border border-line bg-surface text-fg px-3 py-2.5 text-base min-h-[44px]";

  return (
    <Modal open onClose={onClose} title="Filtrlar">
      <div className="space-y-4 pb-2">
        <div>
          <p className="text-sm font-medium text-fg mb-1.5">Turi</p>
          <Tanlovlar
            variantlar={[
              { qiymat: "", nomi: "Barchasi" },
              { qiymat: "kirim", nomi: "Kirim" },
              { qiymat: "chiqim", nomi: "Chiqim" },
            ]}
            faol={f.turi}
            onChange={(v) => set({ turi: v, categoryId: "" })}
          />
        </div>

        <div>
          <p className="text-sm font-medium text-fg mb-1.5">To&apos;lov turi</p>
          <Tanlovlar
            variantlar={[
              { qiymat: "", nomi: "Barchasi" },
              ...TOLOV_GURUHLARI.map((g) => ({
                qiymat: g,
                nomi: `${TOLOV_GURUHI_BELGI[g]} ${TOLOV_GURUHI_NOMI[g]}`,
              })),
            ]}
            faol={f.tolov}
            onChange={(v) => set({ tolov: v })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg mb-1.5" htmlFor="filtr-kategoriya">
            Kategoriya
          </label>
          <Select
            id="filtr-kategoriya"
            value={f.categoryId}
            onChange={(v) => set({ categoryId: v })}
            searchable={korinadiganKategoriyalar.length > 7}
            options={[
              { value: "", label: "Barchasi" },
              ...korinadiganKategoriyalar.map((c) => ({ value: c.id, label: c.nomi })),
            ]}
          />
        </div>

        {xodimlar.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-fg mb-1.5" htmlFor="filtr-xodim">
              Kim kiritdi
            </label>
            <Select
              id="filtr-xodim"
              value={f.xodimId}
              onChange={(v) => set({ xodimId: v })}
              searchable={xodimlar.length > 7}
              options={[
                { value: "", label: "Barchasi" },
                ...xodimlar.map((x) => ({ value: x.id, label: x.ism })),
              ]}
            />
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-fg mb-1.5">Sana oralig&apos;i</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-2xs text-muted">Dan</span>
              <input
                type="date"
                value={f.from}
                onChange={(e) => set({ from: e.target.value })}
                className={`mt-0.5 ${MAYDON}`}
              />
            </label>
            <label className="block">
              <span className="text-2xs text-muted">Gacha</span>
              <input
                type="date"
                value={f.to}
                onChange={(e) => set({ to: e.target.value })}
                className={`mt-0.5 ${MAYDON}`}
              />
            </label>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-fg mb-1.5">Summa oralig&apos;i</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={f.minSumma}
              onChange={(e) => set({ minSumma: e.target.value ? formatSom(parseSomInput(e.target.value)) : "" })}
              placeholder="0"
              aria-label="Summa (dan)"
              className={`${MAYDON} tnum`}
            />
            <input
              type="text"
              inputMode="numeric"
              value={f.maxSumma}
              onChange={(e) => set({ maxSumma: e.target.value ? formatSom(parseSomInput(e.target.value)) : "" })}
              placeholder="∞"
              aria-label="Summa (gacha)"
              className={`${MAYDON} tnum`}
            />
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-surface border-t border-line flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            size="lg"
            onClick={() => {
              // Qidiruv matni tozalanmaydi — u varaqda emas, tepada turadi.
              setF({ ...BOSH_FILTR, q: f.q });
              onApply({ ...BOSH_FILTR, q: f.q });
            }}
          >
            Tozalash
          </Button>
          <Button className="flex-1" size="lg" onClick={() => onApply(f)}>
            Natijalarni ko&apos;rsatish
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Tanlovlar({
  variantlar,
  faol,
  onChange,
}: {
  variantlar: { qiymat: string; nomi: string }[];
  faol: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {variantlar.map((v) => (
        <button
          key={v.qiymat}
          type="button"
          onClick={() => onChange(v.qiymat)}
          aria-pressed={faol === v.qiymat}
          className={`px-3 py-2 min-h-[44px] rounded-lg border text-sm transition ${
            faol === v.qiymat
              ? "border-brand bg-brand-wash text-brand font-medium"
              : "border-line bg-surface text-fg hover:border-brand"
          }`}
        >
          {v.nomi}
        </button>
      ))}
    </div>
  );
}
