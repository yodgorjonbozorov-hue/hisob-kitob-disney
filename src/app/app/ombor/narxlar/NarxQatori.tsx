"use client";

import { formatSom } from "@/lib/format";
import type { ProductAdminDTO } from "@/lib/queries/inventory";
import type { Kiritma } from "./NarxlarClient";

/**
 * Jadvalning bitta qatori.
 *
 * Kataklar BO'SH boshlanmaydi: mavjud qiymat ko'rinib turadi, shu bilan
 * foydalanuvchi nimani o'zgartirayotganini biladi. Qiymati yo'q (0) katak
 * esa bo'sh qoladi — "0" yozib qo'yish "narx nol so'm" degan taassurot
 * berardi.
 */
export function NarxQatori({
  product,
  kiritma,
  onOzgartir,
}: {
  product: ProductAdminDTO;
  kiritma: Kiritma | undefined;
  onOzgartir: (maydon: keyof Kiritma, qiymat: string) => void;
}) {
  const kelgan = kiritma?.kelgan ?? (product.kelganNarx > 0 ? formatSom(product.kelganNarx) : "");
  const sotuv = kiritma?.sotuv ?? (product.sotuvNarx > 0 ? formatSom(product.sotuvNarx) : "");
  const qoldiq = kiritma?.qoldiq ?? (product.miqdor > 0 ? String(product.miqdor) : "");
  const bosh = product.sotuvNarx === 0 || product.miqdor === 0;

  const input =
    "w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg text-right tnum";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-[1fr_130px_130px_110px] gap-2 lg:gap-3 px-4 py-3 items-center">
      <div className="col-span-2 lg:col-span-1 min-w-0">
        <p className="text-sm text-fg truncate">
          {product.nomi}
          {bosh && <span className="ml-2 text-2xs text-expense">to&apos;ldirilmagan</span>}
        </p>
        {product.sku && <p className="text-2xs text-faint font-mono">{product.sku}</p>}
      </div>

      <label className="lg:hidden text-2xs text-muted">Tannarx</label>
      <input
        inputMode="numeric"
        value={kelgan}
        onChange={(e) => onOzgartir("kelgan", e.target.value)}
        placeholder="0"
        className={input}
        aria-label={`${product.nomi} — tannarx`}
      />

      <label className="lg:hidden text-2xs text-muted">Sotuv narxi</label>
      <input
        inputMode="numeric"
        value={sotuv}
        onChange={(e) => onOzgartir("sotuv", e.target.value)}
        placeholder="0"
        className={input}
        aria-label={`${product.nomi} — sotuv narxi`}
      />

      <label className="lg:hidden text-2xs text-muted">Qoldiq</label>
      <input
        inputMode="numeric"
        value={qoldiq}
        onChange={(e) => onOzgartir("qoldiq", e.target.value)}
        placeholder="0"
        className={input}
        aria-label={`${product.nomi} — qoldiq`}
      />
    </div>
  );
}
